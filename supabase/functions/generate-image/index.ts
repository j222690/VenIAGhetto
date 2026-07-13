// Edge Function: generate-image
// -----------------------------------------------------------------------------
// Ponte SEGURA para o Gemini. A GEMINI_API_KEY vive como secret aqui (servidor)
// e NUNCA vai para o frontend. Exige um usuário Supabase autenticado (verify_jwt).
//
// Modos:
//   • mode "image" (padrão): gera/edita imagem com gemini-2.5-flash-image.
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

const IMAGE_MODEL = "gemini-2.5-flash-image";
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
  return { mimeType, data: btoa(bin) };
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

async function geminiImage(prompt: string, images: InputImage[]) {
  const res = await fetch(`${GENAI}/${IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: buildParts(prompt, images) }] }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "Gemini image error");
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p: any) => p.inlineData ?? p.inline_data);
  const d = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!d?.data) throw new Error("O modelo não retornou uma imagem.");
  return { mimeType: d.mimeType ?? d.mime_type ?? "image/png", data: d.data as string };
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

    // mode === "image"
    const { mimeType, data } = await geminiImage(prompt, inputImages);
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
