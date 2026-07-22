// Edge Function: import-catalog
// -----------------------------------------------------------------------------
// Recebe um LINK (e-commerce, Instagram, etc.), busca o HTML no servidor (sem
// CORS) e usa o Gemini para extrair a lista de produtos. Exige usuário
// autenticado. A cobrança de tokens é feita no app após o retorno.
//
// Limitações honestas (ainda existem após o aumento do limite de HTML):
//   • Páginas 100% dinâmicas (SPA que carrega produtos via JS/fetch depois do
//     carregamento inicial) ou o Instagram (muro de login) podem devolver
//     pouco conteúdo — só extraímos o que já vem pronto no HTML da resposta,
//     não executamos JavaScript nem esperamos a página "montar".
//   • Catálogo paginado (?page=2, "carregar mais"): só a página do LINK
//     enviado é lida — não segue paginação automaticamente.
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TEXT_MODEL = "gemini-2.5-flash";
const GENAI = "https://generativelanguage.googleapis.com/v1beta/models";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Bloqueia hosts internos/privados (anti-SSRF). Cobre os casos óbvios; não
// resolve DNS-rebinding, mas impede localhost, faixas privadas e metadata.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h === "metadata.google.internal"
  ) {
    return true;
  }
  // IPv6 loopback / unique-local / link-local.
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) {
    return true;
  }
  // IPv4 em faixas privadas/loopback/link-local/metadata.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    void c;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    // Exige saldo > 0 — sem isso, dava pra chamar esta função direto (fora do
    // app) pra buscar/analisar QUALQUER url de graça e sem limite, mesmo com
    // 0 tokens (a cobrança de verdade continua acontecendo no app, por item).
    const { data: store } = await authed.from("stores").select("tokens_balance").single();
    if ((store?.tokens_balance ?? 0) <= 0) {
      return json({ error: "Saldo de tokens insuficiente." }, 402);
    }

    const { url } = await req.json().catch(() => ({}));
    if (!url || !/^https?:\/\//i.test(url)) {
      return json({ error: "Informe um link válido (começando com http)." }, 400);
    }
    // Anti-SSRF: bloqueia localhost, IPs privados/link-local e metadata de nuvem.
    if (isBlockedHost(new URL(url).hostname)) {
      return json({ error: "Este endereço não é permitido." }, 400);
    }

    // Busca a página como um navegador comum.
    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch {
      return json({ error: "Não foi possível acessar o link. Verifique o endereço." }, 502);
    }

    // Limita o tamanho para caber no contexto do modelo (Gemini 2.5 Flash
    // aguenta ~1M tokens — 900k caracteres de HTML cabe folgado). Era 200k
    // antes, o que cortava páginas de catálogo reais no meio da lista de
    // produtos (o resto nunca chegava a ser visto pela IA).
    const clipped = html.slice(0, 900_000);
    const origin = new URL(url).origin;

    const prompt =
      "Você extrai catálogos de moda de páginas web. A seguir está o HTML de uma página " +
      `(origem: ${origin}). Extraia TODOS os PRODUTOS de moda encontrados (não pule nenhum) e ` +
      "responda APENAS um JSON array válido (sem markdown, sem crases) de objetos com as chaves: " +
      '"name" (nome do produto), "category" (categoria ou ""), "price" (número em reais ou null), ' +
      '"imageUrl" (URL ABSOLUTA da imagem do produto ou ""). Converta URLs relativas em absolutas ' +
      "usando a origem. Use SOMENTE dados presentes no HTML — não invente. Se não houver produtos, " +
      "responda []. Máximo 200 itens.\n\nHTML:\n" +
      clipped;

    const gRes = await fetch(`${GENAI}/${TEXT_MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const gJson = await gRes.json();
    if (gJson.error) throw new Error(gJson.error.message ?? "Erro na extração");
    const raw = (gJson.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text ?? "")
      .join("")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let products: unknown = [];
    try {
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      products = JSON.parse(raw.slice(start, end + 1));
    } catch {
      products = [];
    }
    if (!Array.isArray(products)) products = [];

    return json({ products });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
