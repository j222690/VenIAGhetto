// Edge Function: mercadopago-oauth
// -----------------------------------------------------------------------------
// Conecta a conta Mercado Pago DO DONO DO APP, que é para onde vai o dinheiro
// das assinaturas e dos pacotes que os lojistas pagam.
//
// NÃO é por loja: lojista nenhum conecta nada aqui, ele só paga. Quem conecta
// é quem recebe, e isso é uma conta só.
//
// POR QUE OAUTH E NÃO "COLE SEU TOKEN AQUI"
// Pedir token significa pedir para a lojista criar conta de desenvolvedor,
// achar "credenciais de produção" e copiar a chave certa entre quatro. Ela
// desiste, ou cola a de teste e as cobranças falham em silêncio. Com OAuth ela
// clica em Conectar e entra na conta que já usa.
//
// TRÊS CAMINHOS
//   POST { action:"authorize" }  → devolve a URL para onde mandar a lojista.
//   GET  ?code=…&state=…         → o Mercado Pago devolve a lojista AQUI;
//                                  troca o code por tokens e manda ela de
//                                  volta ao app.
//   POST { action:"disconnect" } → esquece a conta.
//
// O ESTADO É ASSINADO. O `state` carrega a loja, e o Mercado Pago o devolve
// como veio. Sem assinar, qualquer um chamaria o retorno com o state de outra
// loja e plantaria a própria conta de recebimento nela — todo o faturamento
// dessa loja passaria a cair na conta do atacante. O HMAC e o prazo curto são
// o que impedem isso.
//
// IMPORTANTE: deploy com verify_jwt DESLIGADO — o retorno do Mercado Pago é um
// GET de navegador, sem JWT. As ações POST conferem o usuário na mão:
//   supabase functions deploy mercadopago-oauth --no-verify-jwt --project-ref <ref>
//
// Secrets: MP_CLIENT_ID, MP_CLIENT_SECRET, MP_OAUTH_REDIRECT, APP_URL,
//          ADMIN_STORE_ID
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("MP_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("MP_CLIENT_SECRET") ?? "";
const REDIRECT = Deno.env.get("MP_OAUTH_REDIRECT") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const ADMIN_STORE_ID = (Deno.env.get("ADMIN_STORE_ID") ?? "").trim();

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// O state vale poucos minutos: é o tempo de a lojista autorizar, não um
// passe permanente para plantar conta de recebimento numa loja.
const STATE_VALIDO_MS = 15 * 60 * 1000;

async function hmac(texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CLIENT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function assinaEstado(storeId: string): Promise<string> {
  const corpo = `${storeId}.${Date.now()}`;
  return `${corpo}.${await hmac(corpo)}`;
}

async function leEstado(state: string): Promise<string | null> {
  const [storeId, ts, assinatura] = String(state ?? "").split(".");
  if (!storeId || !ts || !assinatura) return null;
  const esperado = await hmac(`${storeId}.${ts}`);
  // Comparação de tempo constante.
  if (esperado.length !== assinatura.length) return null;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ assinatura.charCodeAt(i);
  if (diff !== 0) return null;
  if (Date.now() - Number(ts) > STATE_VALIDO_MS) return null;
  return storeId;
}

function paraOApp(caminho: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${APP_URL}${caminho}` } });
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT) {
    return json({ error: "Conexão com o Mercado Pago não configurada." }, 503);
  }

  // ---- Retorno do Mercado Pago (navegador, sem JWT) -----------------------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const erro = url.searchParams.get("error");
    if (erro) return paraOApp(`/settings?mp=negado`);

    const storeId = code ? await leEstado(state) : null;
    // Confere de novo no retorno: um state assinado no passado para outra loja
    // não deve conseguir plantar conta de recebimento agora.
    if (!storeId || storeId !== ADMIN_STORE_ID) return paraOApp(`/settings?mp=invalido`);

    try {
      const res = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT,
        }),
      });
      const t = await res.json();
      if (!res.ok || !t.access_token) {
        console.error("[mp-oauth] troca falhou:", JSON.stringify(t).slice(0, 300));
        return paraOApp(`/settings?mp=falhou`);
      }

      // expires_in vem em segundos (180 dias hoje). Guardar a data evita
      // descobrir que venceu só quando uma cobrança falhar.
      const expira = new Date(Date.now() + Number(t.expires_in ?? 0) * 1000).toISOString();
      await admin.from("mp_accounts").upsert(
        {
          store_id: storeId,
          mp_user_id: String(t.user_id ?? ""),
          access_token: t.access_token,
          refresh_token: t.refresh_token ?? "",
          public_key: t.public_key ?? null,
          live_mode: t.live_mode !== false,
          expires_at: expira,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" },
      );
      await admin
        .from("stores")
        .update({ mp_connected_at: new Date().toISOString() })
        .eq("id", storeId);

      // live_mode falso = a lojista autorizou com credenciais de teste. A
      // cobrança de verdade falharia sem explicação, então a tela avisa.
      return paraOApp(t.live_mode === false ? `/settings?mp=teste` : `/settings?mp=conectado`);
    } catch (e) {
      console.error("[mp-oauth]", (e as Error).message);
      return paraOApp(`/settings?mp=falhou`);
    }
  }

  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  // ---- Ações do app (exigem usuário dono da loja) -------------------------
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    // Esta é a conta que recebe o faturamento do app inteiro, então quem
    // conecta é o dono do APP — não o dono de uma loja qualquer. Sem esta
    // conferência, qualquer lojista apontaria a receita das assinaturas para a
    // conta dele. O gate do frontend é só UX; este é o que vale.
    const { data: perfil } = await authed
      .from("users")
      .select("store_id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!perfil?.store_id) return json({ error: "Loja não encontrada." }, 400);
    if (!ADMIN_STORE_ID || perfil.store_id !== ADMIN_STORE_ID || perfil.role !== "owner") {
      return json({ error: "Só o dono do app pode conectar o Mercado Pago." }, 403);
    }

    const body = await req.json().catch(() => ({}));

    if (body.action === "authorize") {
      const state = await assinaEstado(perfil.store_id);
      const url =
        `https://auth.mercadopago.com.br/authorization?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT)}`;
      return json({ url });
    }

    if (body.action === "disconnect") {
      await admin.from("mp_accounts").delete().eq("store_id", perfil.store_id);
      await admin.from("stores").update({ mp_connected_at: null }).eq("id", perfil.store_id);
      return json({ disconnected: true });
    }

    return json({ error: "Requisição inválida." }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
