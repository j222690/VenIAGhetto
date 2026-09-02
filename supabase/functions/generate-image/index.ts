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
//   • mode "text": texto com gemini-3.6-flash. body: { prompt, images? } → { text }
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { avisarUsuario } from "../_shared/push.ts";

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
// gemini-2.5-flash foi descontinuado pelo Google pra novos usuários (erro real
// observado: "no longer available to new users"). gemini-3.6-flash foi o
// substituto indicado pela própria mensagem de erro da API.
const TEXT_MODEL = "gemini-3.6-flash";
const GENAI = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENAI_VISION_MODEL = "gpt-4o";

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

// `imageUrls` (fotos reais hospedadas — pessoa, peça) vêm ANTES de `images`
// (inline, ex.: a grade de quadrantes montada no cliente) — a detecção de
// aspect ratio usa a PRIMEIRA imagem (`inputImages[0]`), e precisa ser a foto
// real da pessoa, não uma grade auxiliar sempre quadrada.
async function resolveImages(images?: InputImage[], imageUrls?: string[]): Promise<InputImage[]> {
  const out: InputImage[] = [];
  for (const u of imageUrls ?? []) out.push(await urlToInline(u));
  out.push(...(images ?? []));
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
  imageOpts?: { imageSize?: "1K" | "2K" | "4K"; aspectRatio?: string; timeoutMs?: number },
) {
  const generationConfig: Record<string, unknown> = { responseModalities: ["TEXT", "IMAGE"] };
  if (imageOpts?.imageSize || imageOpts?.aspectRatio) {
    generationConfig.imageConfig = {
      ...(imageOpts.imageSize ? { imageSize: imageOpts.imageSize } : {}),
      ...(imageOpts.aspectRatio ? { aspectRatio: imageOpts.aspectRatio } : {}),
    };
  }
  // Instrumentação de latência: sem isso não dá pra distinguir "a geração é
  // um pouco mais lenta" de "estourou o timeout e recomeçou no fallback" —
  // são problemas diferentes, com correções diferentes. Loga o tempo real de
  // cada modelo, junto do tamanho do prompt e do nº de imagens de entrada
  // (as duas variáveis que mais mexem no custo da chamada).
  const startedAt = Date.now();
  const shape = `prompt ${prompt.length} chars, ${images.length} img(s), aspectRatio ${imageOpts?.aspectRatio ?? "auto"}, size ${imageOpts?.imageSize ?? "default"}`;
  let res: Response;
  try {
    res = await fetch(`${GENAI}/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: buildParts(prompt, images) }],
        generationConfig,
      }),
      // Sem isso, um modelo lento/sobrecarregado deixa a chamada pendurada até o
      // limite de execução da Edge Function matar a função sem aviso — o
      // cliente só via "demorou demais" sem nunca chegar a tentar o fallback.
      // Com o timeout, uma trava clara aqui dispara o fallback (ou o erro final)
      // bem mais rápido, dentro de um tempo previsível.
      signal: imageOpts?.timeoutMs ? AbortSignal.timeout(imageOpts.timeoutMs) : undefined,
    });
  } catch (err) {
    if ((err as Error)?.name === "TimeoutError" || (err as Error)?.name === "AbortError") {
      console.warn(`[generate-image] ${model} TIMEOUT após ${Date.now() - startedAt}ms — ${shape}`);
      throw new Error(`${model} não respondeu a tempo (sobrecarregado).`);
    }
    throw err;
  }
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? `${model} image error`);
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p: any) => p.inlineData ?? p.inline_data);
  const d = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!d?.data) throw new Error(`${model} não retornou uma imagem.`);
  console.log(`[generate-image] ${model} OK em ${Date.now() - startedAt}ms — ${shape}`);
  return { mimeType: d.mimeType ?? d.mime_type ?? "image/png", data: d.data as string };
}

async function geminiImage(
  prompt: string,
  images: InputImage[],
  aspectRatio?: string,
  imageSize: "1K" | "2K" = "1K",
  // "sincrono": a Supabase encerra a função em 150s, então as tentativas
  // precisam caber nisso. "assincrono": rodando em background o orçamento é
  // 400s, e cortar o modelo aos 70s desperdiça justamente a folga que a
  // geração em segundo plano foi criada pra ter — MEDIDO: uma geração
  // assíncrona morreu aos 125s por causa desses tetos antigos.
  orcamento: "sincrono" | "assincrono" = "sincrono",
) {
  // ESTRATÉGIA (medida, não chutada): num lote de 5 gerações de Grade de
  // Looks, 3 falharam — e nas 3 o modelo principal estourou o teto E o
  // gemini-2.5-flash-image (legado, que o Google vai desligar) também não
  // entregou. O legado NÃO está servindo de rede de segurança hoje.
  //
  // Então a ordem virou: principal → principal de novo → legado só em último
  // caso. Uma segunda tentativa no modelo BOM vale mais que uma primeira no
  // ruim. E repetir NÃO custa nada no caminho feliz: a 2ª tentativa só existe
  // quando a alternativa era devolver erro pro lojista.
  //
  // Tetos curtos de propósito (alvo de produto: geração em menos de 1 minuto).
  // A 2ª tentativa tem teto MENOR: se a 1ª já demorou o teto inteiro, o
  // provedor está ruim, e insistir muito só faz o lojista esperar mais.
  // 1K: 2K custaria ~50% mais caro ($0,101 vs $0,067/imagem) por pouco ganho
  // real. aspectRatio: sem isso o modelo usa o formato padrão dele (~quadrado)
  // e espreme a pessoa. Só o principal aceita imageConfig — o legado não.
  // ASSÍNCRONO: UMA tentativa só, sem abortar-e-recomeçar.
  //
  // MEDIDO (7 de 7): quando paramos de esperar, o Gemini NÃO para — ele
  // termina e devolve a imagem completa mesmo assim, e cobra por ela. Então
  // abortar aos 70s pra tentar de novo jogava fora uma imagem já paga e
  // comprava outra: 2 imagens pagas pra entregar 1.
  //
  // Como aqui a função já respondeu ao lojista e o trabalho segue em segundo
  // plano, não existe pressa de tela: dá pra simplesmente ESPERAR a primeira
  // chegar. Uma geração pedida = uma imagem paga.
  //
  // 300s deixa ~100s de folga até o limite de 400s da tarefa em background —
  // margem pro download das imagens de entrada e o upload do resultado.
  // ERRO REAL que essa folga corrige: com 360s de tetos somados, a função foi
  // morta no meio e a linha ficou presa em "processando" (medido: 356s).
  const tentativas: { modelo: string; timeoutMs: number; comConfig: boolean }[] =
    orcamento === "assincrono"
      ? [{ modelo: IMAGE_MODEL, timeoutMs: 300_000, comConfig: true }]
      : [
          { modelo: IMAGE_MODEL, timeoutMs: 70_000, comConfig: true },
          { modelo: IMAGE_MODEL, timeoutMs: 50_000, comConfig: true },
          { modelo: IMAGE_MODEL_FALLBACK, timeoutMs: 45_000, comConfig: false },
        ];

  let ultimoErro: unknown = null;
  for (let i = 0; i < tentativas.length; i++) {
    const t = tentativas[i];
    try {
      return await callImageModel(
        t.modelo,
        prompt,
        images,
        t.comConfig
          ? { imageSize, aspectRatio, timeoutMs: t.timeoutMs }
          : { timeoutMs: t.timeoutMs },
      );
    } catch (err) {
      ultimoErro = err;
      console.warn(
        `[generate-image] tentativa ${i + 1}/${tentativas.length} (${t.modelo}) falhou:`,
        (err as Error)?.message,
      );
    }
  }
  // Mensagem única e amigável quando TODAS as tentativas falham — não expõe
  // nome de modelo nem erro técnico pro lojista.
  console.warn("[generate-image] todas as tentativas falharam:", (ultimoErro as Error)?.message);
  throw new Error("O serviço de IA está sobrecarregado no momento. Tente novamente em alguns instantes.");
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

// Visão com FALLBACK: OpenAI primeiro, Gemini quando ela falhar.
//
// Por que existe: a chave da OpenAI ficou sem crédito e TODA a visão do app
// parou — o aviso de foto de peça ruim (garmentPhotoTip), a legenda por IA
// dos posts (generatePostCopy) e a guarda do Criar corpo (bodyFramingCheck).
// Os três engolem o erro de propósito, pra um serviço auxiliar fora do ar não
// travar o lojista; o efeito colateral é que pararam EM SILÊNCIO e ninguém
// percebeu até alguém investigar.
//
// A OpenAI segue como PRINCIPAL de propósito: quem paga essa conta é o cliente
// do lojista, e trocar a ordem transferiria o custo pra chave do Gemini (que é
// nossa). O Gemini só entra quando a alternativa seria não funcionar.
async function visionWithFallback(prompt: string, imageUrls: string[]): Promise<string> {
  try {
    return await openaiVision(prompt, imageUrls);
  } catch (err) {
    console.warn(
      `[generate-image] visão OpenAI falhou, caindo pro Gemini:`,
      (err as Error)?.message,
    );
    // O Gemini precisa da imagem inline (base64), não por URL como a OpenAI.
    const images: InputImage[] = [];
    for (const u of imageUrls) images.push(await urlToInline(u));
    // Duas tentativas: MEDIDO que o próprio Gemini às vezes responde
    // "This model is currently experiencing high demand" — 1 de 3 chamadas no
    // teste. Repetir custa tempo só quando a alternativa era falhar.
    for (let i = 1; i <= 2; i++) {
      try {
        const text = await geminiText(prompt, images);
        console.log(`[generate-image] visão atendida pelo Gemini (${text.length} chars)`);
        return text;
      } catch (e) {
        console.warn(`[generate-image] visão Gemini tentativa ${i}/2 falhou:`, (e as Error)?.message);
        if (i === 2) throw e;
      }
    }
    throw new Error("Visão indisponível.");
  }
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

// Custo em tokens por feature — validado e cobrado AQUI (servidor), nunca
// confiando num valor vindo do cliente. Espelha GenerationService.ts /
// RefinePanel.tsx / catalog.tsx — se o preço mudar lá, muda aqui também.
// SEGURANÇA: sem essa cobrança server-side, qualquer usuário autenticado
// podia chamar esta função direto (fora do app) e gerar imagens de graça —
// o desconto de token só acontecia no frontend, DEPOIS da chamada cara à IA
// já ter sido paga por nós de qualquer forma.
const FEATURE_COST: Record<string, number> = {
  tryon: 1,
  post: 1,
  refine: 1,
  clean_image: 1,
  // Criar corpo: completa uma foto de meio corpo em corpo inteiro, pra a foto
  // servir de base no Provador. 1 chamada de imagem, mesmo custo real das
  // outras — por isso 1 token, como o resto.
  criar_corpo: 1,
};

// Reembolsa (service_role) se o débito foi feito mas a chamada de IA falhou
// depois — não expõe crédito ao cliente, só corrige internamente aqui.
async function refundTokens(admin: ReturnType<typeof createClient>, userId: string, amount: number) {
  const { data: u } = await admin.from("users").select("store_id").eq("id", userId).single();
  const storeId = u?.store_id;
  if (!storeId) return;
  const { data: store } = await admin.from("stores").select("tokens_balance").eq("id", storeId).single();
  if (!store) return;
  await admin.from("stores").update({ tokens_balance: store.tokens_balance + amount }).eq("id", storeId);
  await admin.from("token_transactions").insert({ store_id: storeId, type: "credit", amount });
}

// Gera a imagem e sobe no Storage. Usado tanto pelo modo síncrono quanto pelo
// assíncrono — a diferença entre os dois é QUANDO isso roda, não o que faz.
async function gerarESubir(
  admin: ReturnType<typeof createClient>,
  userId: string,
  prompt: string,
  inputImages: InputImage[],
  aspectRatio: string | undefined,
  imageSize: "1K" | "2K",
  orcamento: "sincrono" | "assincrono" = "sincrono",
): Promise<string> {
  const { mimeType, data } = await geminiImage(
    prompt,
    inputImages,
    aspectRatio,
    imageSize,
    orcamento,
  );
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("generated")
    .upload(path, base64ToBytes(data), {
      contentType: mimeType,
      upsert: false,
      cacheControl: "31536000",
    });
  if (upErr) throw upErr;
  return admin.storage.from("generated").getPublicUrl(path).data.publicUrl;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

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

    // "rescue_stuck" é o único modo que não gera nada — é limpeza, e não tem
    // prompt. A validação abaixo vale para todos os outros.
    if (mode !== "rescue_stuck" && !prompt.trim()) {
      return json({ error: "Prompt vazio." }, 400);
    }

    // Saldo > 0 exigido pra visão/texto (não cobram token próprio — ficam
    // embutidos no custo da feature principal — mas sem esse mínimo dava pra
    // abusar de graça mesmo com 0 tokens). RLS já restringe a leitura à
    // própria loja (stores_select_own).
    async function hasAnyBalance(): Promise<boolean> {
      const { data } = await authed.from("stores").select("tokens_balance").single();
      return (data?.tokens_balance ?? 0) > 0;
    }

    // Visão (OpenAI) — analisa imagens por URL, não precisa baixar/inline.
    // RESGATE de gerações presas em "processando".
    //
    // A tarefa em segundo plano é encerrada aos 400s. Se isso pegar a geração
    // no meio, ela morre sem rodar o tratamento de erro: a linha fica
    // "processando" pra sempre e o token NÃO volta (aconteceu num teste, linha
    // parada em 356s). Nenhum teto elimina isso — pode ser limite de CPU, de
    // memória, ou um deploy no meio da geração.
    //
    // Roda AQUI, e não no frontend, porque o reembolso mexe em saldo: dar ao
    // cliente a capacidade de creditar tokens seria dar saldo infinito a
    // qualquer um que chamasse a API direto. O cliente só PEDE o resgate; a
    // verificação de quais linhas realmente estão presas é nossa.
    if (mode === "rescue_stuck") {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: u } = await admin.from("users").select("store_id").eq("id", user.id).single();
      const storeId = (u as { store_id?: string } | null)?.store_id;
      if (!storeId) return json({ resgatadas: 0 });

      // 10 minutos: acima do teto de 300s da geração mais o overhead, então
      // não mata nada que ainda pudesse terminar sozinho.
      const limite = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: presas } = await admin
        .from("generations")
        .update({
          status: "falhou",
          error_message: "A geração foi interrompida antes de terminar. Seu token foi devolvido.",
          finished_at: new Date().toISOString(),
        })
        .eq("store_id", storeId)
        .eq("status", "processando")
        .lt("created_at", limite)
        .select("id,tokens_used");

      const linhas = (presas ?? []) as { id: string; tokens_used: number | null }[];
      for (const g of linhas) {
        await refundTokens(admin, user.id, g.tokens_used ?? 1);
      }
      if (linhas.length) {
        console.log(`[rescue] ${linhas.length} geração(ões) presa(s) resgatada(s) na loja ${storeId}`);
      }
      return json({ resgatadas: linhas.length });
    }

    if (mode === "vision") {
      if (!(await hasAnyBalance())) return json({ error: "Saldo de tokens insuficiente." }, 402);
      const urls: string[] = body.imageUrls ?? [];
      urls.forEach(assertAllowedImageUrl);
      const text = await visionWithFallback(prompt, urls);
      return json({ text });
    }

    const inputImages = await resolveImages(body.images, body.imageUrls);

    if (mode === "text") {
      if (!(await hasAnyBalance())) return json({ error: "Saldo de tokens insuficiente." }, 402);
      const text = await geminiText(prompt, inputImages);
      return json({ text });
    }

    // mode === "image_async" — MESMA geração, mas sem prender o lojista.
    //
    // POR QUE EXISTE (medido nesta base):
    //  • A Supabase encerra uma Edge Function SÍNCRONA em 150s, em qualquer
    //    plano. O Gemini leva de 11s a 131s — o limite está DENTRO da faixa
    //    normal de operação, então gerações lentas viravam erro de gateway.
    //  • O Google cobra a imagem mesmo quando desistimos de esperar: 7 de 7
    //    requisições abandonadas voltaram COM imagem completa. Toda geração
    //    morta no teto era dinheiro pago e jogado fora.
    //
    // Respondendo na hora e terminando com EdgeRuntime.waitUntil, o orçamento
    // vai a 400s (acima do pior caso já medido), nenhuma imagem paga se perde,
    // e some a necessidade de repetir — o que devolve o custo a 1 chamada por
    // geração. O cliente cria a linha em `generations` com status
    // 'processando' e passa o id aqui; nós a completamos quando terminar.
    if (mode === "image_async") {
      const feature: string = (body.feature ?? "").toString();
      const cost = FEATURE_COST[feature];
      if (cost === undefined) return json({ error: "Feature de geração inválida." }, 400);
      const generationId: string = (body.generationId ?? "").toString();
      if (!generationId) return json({ error: "generationId obrigatório." }, 400);

      const { data: newBalance, error: debitErr } = await authed.rpc("debit_tokens", {
        p_amount: cost,
        p_reason: `Geração: ${feature}`,
      });
      if (debitErr) return json({ error: "Saldo de tokens insuficiente." }, 402);

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      let aspectRatio: string | undefined = body.aspectRatio;
      if (!aspectRatio) {
        const base = inputImages[0];
        if (base?.width && base?.height) aspectRatio = nearestAspectRatio(base.width, base.height);
      }
      const imageSize: "1K" | "2K" = body.imageSize === "2K" ? "2K" : "1K";

      const trabalho = (async () => {
        const t0 = Date.now();
        try {
          const url = await gerarESubir(
            admin,
            user.id,
            prompt,
            inputImages,
            aspectRatio,
            imageSize,
            "assincrono",
          );
          await admin
            .from("generations")
            .update({ output_url: url, status: "pronta", finished_at: new Date().toISOString() })
            .eq("id", generationId);
          console.log(`[async] ${generationId} PRONTA em ${Date.now() - t0}ms`);
          // Avisa mesmo com o app FECHADO (Web Push). Se o lojista estiver com
          // a tela aberta, ele já viu o resultado — o service worker não
          // duplica porque a sondagem some com o overlay antes.
          await avisarUsuario(admin, user.id, {
            title: "Vest Ai",
            body: "Sua imagem está pronta!",
            // Leva ao RESULTADO daquela geração, não ao álbum: quem toca no
            // aviso quer ver a imagem que acabou de ficar pronta, e no álbum
            // ainda teria de procurá-la no meio das outras.
            url: `/tryon?g=${generationId}`,
          });
        } catch (e) {
          const msg = (e as Error)?.message ?? String(e);
          console.warn(`[async] ${generationId} FALHOU em ${Date.now() - t0}ms: ${msg}`);
          await refundTokens(admin, user.id, cost);
          await admin
            .from("generations")
            .update({ status: "falhou", error_message: msg, finished_at: new Date().toISOString() })
            .eq("id", generationId);
          await avisarUsuario(admin, user.id, {
            title: "Vest Ai",
            body: "Não foi possível gerar sua imagem. Seu token foi devolvido.",
            url: "/tryon",
          });
        }
      })();

      // Mantém a função viva além da resposta. Sem isso o worker é encerrado
      // e a geração morre junto — paga e perdida, que é o que queremos evitar.
      try {
        (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
          .EdgeRuntime?.waitUntil(trabalho);
      } catch {
        /* sem waitUntil: cai no comportamento antigo, a promessa segue solta */
      }

      return json({ generationId, status: "processando", balance: newBalance });
    }

    // mode === "image" — a única chamada realmente cara (Gemini image gen).
    // Cobra o token ANTES de chamar a IA, com o custo determinado pelo
    // SERVIDOR (nunca pelo cliente) a partir de `feature`.
    const feature: string = (body.feature ?? "").toString();
    const cost = FEATURE_COST[feature];
    if (cost === undefined) {
      return json({ error: "Feature de geração inválida." }, 400);
    }
    const { data: newBalance, error: debitErr } = await authed.rpc("debit_tokens", {
      p_amount: cost,
      p_reason: `Geração: ${feature}`,
    });
    if (debitErr) {
      return json({ error: "Saldo de tokens insuficiente." }, 402);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // aspectRatio explícito (body.aspectRatio) vence; sem isso, detecta pelo
    // tamanho REAL da 1ª imagem de referência (a foto base sendo editada) e
    // pede ao Gemini o formato suportado mais próximo.
    let aspectRatio: string | undefined = body.aspectRatio;
    if (!aspectRatio) {
      const base = inputImages[0];
      if (base?.width && base?.height) aspectRatio = nearestAspectRatio(base.width, base.height);
    }
    // Resolução: só "2K" é aceito como alternativa ao padrão. Validado aqui
    // (allowlist), nunca confiando no valor do cliente — 2K custa ~50% mais
    // caro por imagem, então um valor arbitrário vindo do front viraria custo
    // nosso. Qualquer outra coisa (inclusive "4K") cai no padrão 1K.
    const imageSize: "1K" | "2K" = body.imageSize === "2K" ? "2K" : "1K";
    let url: string;
    try {
      url = await gerarESubir(admin, user.id, prompt, inputImages, aspectRatio, imageSize);
    } catch (e) {
      await refundTokens(admin, user.id, cost);
      throw e;
    }
    return json({ url, balance: newBalance });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
