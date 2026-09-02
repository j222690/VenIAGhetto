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
import { corsHeadersFor } from "../_shared/cors.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// gemini-2.5-flash foi descontinuado pelo Google ("no longer available to new
// users") e derrubava TODA importação por link, mesmo quando a página era lida
// sem problema. Mesma troca já feita na generate-image.
const TEXT_MODEL = "gemini-3.6-flash";
const GENAI = "https://generativelanguage.googleapis.com/v1beta/models";

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
  const cors = corsHeadersFor(req);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
    //
    // A mensagem de erro DIZ O QUE ACONTECEU. Antes, link errado, site fora do
    // ar e bloqueio devolviam todos "Não foi possível acessar o link", e o
    // lojista repetia a mesma tentativa sem saber o que corrigir.
    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        const motivo =
          res.status === 404
            ? "Essa página não existe (404). Confira se o link está completo e abre no navegador."
            : res.status === 401 || res.status === 403
              ? "O site recusou nosso acesso. Páginas que exigem login — o Instagram, por exemplo — não podem ser lidas por link."
              : res.status === 429
                ? "O site pediu para esperarmos (limite de acessos). Tente de novo daqui a alguns minutos."
                : `O site respondeu com erro ${res.status}. Tente novamente mais tarde.`;
        return json({ error: motivo }, 502);
      }
      html = await res.text();
    } catch {
      return json(
        {
          error:
            "Não conseguimos abrir esse endereço. Confira se o link está certo e se a página abre no navegador.",
        },
        502,
      );
    }

    // Tira do HTML o que não descreve produto: <script>, <style>, <svg>,
    // <noscript> e comentários. Numa loja real isso é a maior parte do arquivo
    // — e ia inteiro para a IA, que levava de 60s a mais de 150s para ler.
    // Acima de 150s a Supabase encerra a função e o lojista via um erro sem
    // explicação (546). Limpar reduz o texto em ~80% e devolve a leitura para
    // a faixa de segundos, sem perder nome, preço nem imagem.
    const limpo = html
      // Script de CODIGO sai; script de DADOS fica. Muitas lojas guardam o
      // catalogo inteiro num bloco JSON (JSON-LD, __NEXT_DATA__) em vez de no
      // HTML visivel; apagar tudo levaria o catalogo junto. Esses blocos ainda
      // trazem a URL da imagem limpa, enquanto o <img> costuma vir com um
      // placeholder por causa do lazy-load.
      .replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (_m, attrs, corpo) =>
        /application\/(ld\+)?json|__NEXT_DATA__|__NUXT__/i.test(attrs)
          ? `<script${attrs}>${corpo}</script>`
          : " ",
      )
      .replace(/<style([^>]*)>[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg([^>]*)>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<noscript([^>]*)>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/\s{2,}/g, " ");

    // 400k depois da limpeza cobre catálogo grande com folga e segura o tempo
    // de leitura dentro do limite de 150s da plataforma.
    const clipped = limpo.slice(0, 400_000);
    console.log(`[import-catalog] html ${html.length} → limpo ${limpo.length} → enviado ${clipped.length}`);

    // Página praticamente sem texto DEPOIS de tirar script e estilo: é uma loja
    // que monta a vitrine por JavaScript. A checagem tem de vir aqui — no HTML
    // cru, o próprio código JS conta como conteúdo e a página passaria.
    if (clipped.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length < 500) {
      return json(
        {
          error:
            "A página abriu, mas veio sem conteúdo — ela monta os produtos depois de carregar, e não conseguimos ler assim. Tente o link de uma categoria ou de um produto específico.",
        },
        422,
      );
    }
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
