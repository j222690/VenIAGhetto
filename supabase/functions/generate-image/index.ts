// Edge Function: generate-image
// -----------------------------------------------------------------------------
// Ponte SEGURA para o Gemini. A GEMINI_API_KEY vive como secret aqui (servidor)
// e NUNCA vai para o frontend. Exige um usuário Supabase autenticado (verify_jwt).
//
// Modos:
//   • mode "image" (padrão): gera/edita imagem com Gemini 3 Pro Image (Nano
//       Banana Pro) — modelo topo de linha, melhor fidelidade de detalhe do
//       que o gemini-2.5-flash-image (que o Google vai desligar em
//       02/10/2026). Faz fallback pro modelo antigo se a chamada Pro falhar.
//       body: { prompt: string, images?: { mimeType, data(base64) }[] }
//       Faz upload do PNG no bucket `generated` e devolve { url }.
//   • mode "text": texto com gemini-2.5-flash. body: { prompt, images? } → { text }
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Gemini 3.1 Flash Image: ~metade do preço do 3 Pro Image ($0,067/imagem 1K
// vs $0,134) e AINDA suporta aspectRatio (o 2.5 Flash legado não suporta —
// foi descartado por reintroduzir a distorção de fisionomia que o aspect
// ratio corrigiu). Fallback pro 2.5 legado só em último caso (sem aspectRatio).
// OBS: modelos 3.x tendem a RECONSTRUIR a peça no try-on — a fidelidade
// (fecho/botão/costura/modelo) é garantida pela redação do PROMPT (cláusula de
// fidelidade no INÍCIO e no FIM), não pela escolha do modelo.
const IMAGE_MODEL = "gemini-3.1-flash-image";
const IMAGE_MODEL_FALLBACK = "gemini-2.5-flash-image";
const TEXT_MODEL = "gemini-2.5-flash";
const GENAI = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENAI_VISION_MODEL = "gpt-4o";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

interface InputImage {
  mimeType: string;
  data: string;
  width?: number;
  height?: number;
}

// Lê width/height direto dos bytes (sem lib externa) pra pedir ao Gemini o
// aspect ratio de saída mais parecido com o da foto ENVIADA — sem isso o
// modelo usa o formato padrão dele (~quadrado), forçando a pessoa a ser
// espremida/cortada pra caber, o que distorcia a fisionomia. Cobre JPEG e
// PNG (o grosso de fotos de câmera/celular e prints).
function sniffImageDimensions(buf: Uint8Array): { width: number; height: number } | null {
  // PNG: assinatura de 8 bytes + chunk IHDR (width @16, height @20, u32 BE).
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
    const height = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23];
    return { width: width >>> 0, height: height >>> 0 };
  }
  // JPEG: percorre os marcadores até achar um SOFn (0xC0–0xCF, exceto
  // 0xC4/0xC8/0xCC, que não são "start of frame").
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const segLen = (buf[offset + 2] << 8) | buf[offset + 3];
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        const height = (buf[offset + 5] << 8) | buf[offset + 6];
        const width = (buf[offset + 7] << 8) | buf[offset + 8];
        return { width, height };
      }
      offset += 2 + segLen;
    }
  }
  return null;
}

// O Gemini só aceita um conjunto FIXO de aspect ratios — não dá pra pedir o
// tamanho exato em pixels, então escolhe o suportado mais PRÓXIMO da foto
// enviada (comparação em escala log, pra não enviesar retrato vs paisagem).
const SUPPORTED_ASPECT_RATIOS: { label: string; value: number }[] = [
  { label: "1:1", value: 1 },
  { label: "2:3", value: 2 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:3", value: 4 / 3 },
  { label: "4:5", value: 4 / 5 },
  { label: "5:4", value: 5 / 4 },
  { label: "9:16", value: 9 / 16 },
  { label: "16:9", value: 16 / 9 },
  { label: "21:9", value: 21 / 9 },
];

function nearestAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  let best = SUPPORTED_ASPECT_RATIOS[0];
  let bestDiff = Infinity;
  for (const r of SUPPORTED_ASPECT_RATIOS) {
    const diff = Math.abs(Math.log(ratio) - Math.log(r.value));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best.label;
}

// Anti-SSRF: só aceitamos imagens hospedadas no PRÓPRIO Storage do projeto
// (buckets públicos ou signed URLs) — nunca URLs externas/internas arbitrárias.
const STORAGE_HOST = (() => {
  try {
    return new URL(SUPABASE_URL).host;
  } catch {
    return "";
  }
})();

function assertAllowedImageUrl(url: string): void {
  let host = "";
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error("scheme");
    host = u.host;
  } catch {
    throw new Error("URL de imagem inválida.");
  }
  if (host !== STORAGE_HOST) {
    throw new Error("Imagem de referência precisa estar no Storage do projeto.");
  }
}

// Baixa uma imagem por URL (do próprio Storage) e converte para base64 inline.
async function urlToInline(url: string): Promise<InputImage> {
  assertAllowedImageUrl(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar imagem de referência (${res.status}).`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const dims = sniffImageDimensions(buf);
  return { mimeType, data: btoa(bin), width: dims?.width, height: dims?.height };
}

async function resolveImages(images?: InputImage[], imageUrls?: string[]): Promise<InputImage[]> {
  const out: InputImage[] = [...(images ?? [])];
  for (const u of imageUrls ?? []) out.push(await urlToInline(u));
  return out;
}

function buildParts(prompt: string, images: InputImage[]) {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  for (const im of images) {
    parts.push({ inline_data: { mime_type: im.mimeType, data: im.data } });
  }
  return parts;
}

async function callImageModel(
  model: string,
  prompt: string,
  images: InputImage[],
  imageOpts?: { imageSize?: "1K" | "2K" | "4K"; aspectRatio?: string },
) {
  const generationConfig: Record<string, unknown> = { responseModalities: ["TEXT", "IMAGE"] };
  if (imageOpts?.imageSize || imageOpts?.aspectRatio) {
    generationConfig.imageConfig = {
      ...(imageOpts.imageSize ? { imageSize: imageOpts.imageSize } : {}),
      ...(imageOpts.aspectRatio ? { aspectRatio: imageOpts.aspectRatio } : {}),
    };
  }
  const res = await fetch(`${GENAI}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: buildParts(prompt, images) }],
      generationConfig,
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? `${model} image error`);
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p: any) => p.inlineData ?? p.inline_data);
  const d = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!d?.data) throw new Error(`${model} não retornou uma imagem.`);
  return { mimeType: d.mimeType ?? d.mime_type ?? "image/png", data: d.data as string };
}

async function geminiImage(prompt: string, images: InputImage[], aspectRatio?: string) {
  try {
    // 1K: resolução padrão do modelo — 2K custaria ~50% mais caro ($0,101 vs
    // $0,067/imagem) por pouco ganho real de detalhe. aspectRatio: sem isso o
    // modelo usa um formato padrão dele (~quadrado) em vez do formato da foto
    // original, forçando a pessoa a ser espremida/cortada — distorcia a
    // fisionomia. Só o modelo principal suporta imageConfig — o fallback
    // (gemini-2.5-flash-image, legado) não aceita esse parâmetro.
    return await callImageModel(IMAGE_MODEL, prompt, images, { imageSize: "1K", aspectRatio });
  } catch (err) {
    console.warn(`[generate-image] ${IMAGE_MODEL} falhou, caindo pro fallback:`, (err as Error)?.message);
    return await callImageModel(IMAGE_MODEL_FALLBACK, prompt, images);
  }
}

// Visão via OpenAI (gpt-4o): descreve peças/looks a partir das URLs públicas.
async function openaiVision(prompt: string, imageUrls: string[]) {
  const content: Record<string, unknown>[] = [{ type: "text", text: prompt }];
  for (const url of imageUrls) content.push({ type: "image_url", image_url: { url } });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_VISION_MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content }],
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "OpenAI vision error");
  return (j.choices?.[0]?.message?.content ?? "").toString().trim();
}

async function geminiText(prompt: string, images: InputImage[]) {
  const res = await fetch(`${GENAI}/${TEXT_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: buildParts(prompt, images) }] }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "Gemini text error");
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p.text ?? "").join("").trim();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    // Identifica o usuário (também é a autorização: precisa ser um user válido).
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    const body = await req.json().catch(() => ({}));
    const mode: string = body.mode ?? "image";
    const prompt: string = (body.prompt ?? "").toString();

    if (!prompt.trim()) return json({ error: "Prompt vazio." }, 400);

    // Visão (OpenAI) — analisa imagens por URL, não precisa baixar/inline.
    if (mode === "vision") {
      const urls: string[] = body.imageUrls ?? [];
      urls.forEach(assertAllowedImageUrl);
      const text = await openaiVision(prompt, urls);
      return json({ text });
    }

    const inputImages = await resolveImages(body.images, body.imageUrls);

    if (mode === "text") {
      const text = await geminiText(prompt, inputImages);
      return json({ text });
    }

    // mode === "image" — aspectRatio explícito (body.aspectRatio) vence; sem
    // isso, detecta pelo tamanho REAL da 1ª imagem de referência (a foto
    // base sendo editada) e pede ao Gemini o formato suportado mais próximo.
    let aspectRatio: string | undefined = body.aspectRatio;
    if (!aspectRatio) {
      const base = inputImages[0];
      if (base?.width && base?.height) aspectRatio = nearestAspectRatio(base.width, base.height);
    }
    const { mimeType, data } = await geminiImage(prompt, inputImages, aspectRatio);
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: upErr } = await admin.storage
      .from("generated")
      .upload(path, base64ToBytes(data), { contentType: mimeType, upsert: false });
    if (upErr) throw upErr;

    const { data: pub } = admin.storage.from("generated").getPublicUrl(path);
    return json({ url: pub.publicUrl });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
