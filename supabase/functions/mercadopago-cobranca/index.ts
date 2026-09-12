// Edge Function: mercadopago-cobranca
// -----------------------------------------------------------------------------
// Gera um link de pagamento para a loja mandar à cliente. O dinheiro cai na
// conta DA LOJA; a comissão da plataforma sai no mesmo pagamento.
//
// É o outro lado da moeda em relação a `mercadopago-checkout`: lá o Vest Ai
// cobra a assinatura da lojista, na conta do Vest Ai. Aqui a lojista cobra a
// cliente dela, na conta dela, usando o token que veio do OAuth.
//
// A COMISSÃO É CALCULADA AQUI, NUNCA ENVIADA PELO CLIENTE. O corpo manda valor
// e descrição; o percentual sai da constante abaixo. Aceitar a comissão vinda
// da tela deixaria qualquer um zerá-la com uma requisição a mão.
//
// O VALOR VEM DA TELA, e isso é intencional: é a loja cobrando o que ela
// quiser da própria cliente. Por isso existe teto e piso — não para proteger
// o Vest Ai, mas para um erro de digitação não virar uma cobrança de
// R$ 999.999 no nome da loja.
//
// Secrets: MP_CLIENT_ID, MP_CLIENT_SECRET, APP_URL
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { contaDaLoja } from "../_shared/mpConta.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("MP_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("MP_CLIENT_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

/** Comissão da plataforma sobre cada venda da loja. */
const COMISSAO = 0.1;
const VALOR_MIN = 1;
const VALOR_MAX = 50000;

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json({ error: "Conexão com o Mercado Pago não configurada." }, 503);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    const { data: perfil } = await authed
      .from("users")
      .select("store_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!perfil?.store_id) return json({ error: "Loja não encontrada." }, 400);

    const conta = await contaDaLoja(admin, perfil.store_id, CLIENT_ID, CLIENT_SECRET);
    if (!conta) {
      return json(
        { error: "Conecte o Mercado Pago da loja em Ajustes antes de cobrar.", naoConectada: true },
        409,
      );
    }
    if (!conta.liveMode) {
      return json(
        { error: "A conta conectada é de teste. Reconecte com a conta real da loja." },
        409,
      );
    }

    const body = await req.json().catch(() => ({}));
    const valor = Math.round(Number(body.valor) * 100) / 100;
    const descricao = String(body.descricao ?? "").trim().slice(0, 120);
    if (!Number.isFinite(valor) || valor < VALOR_MIN || valor > VALOR_MAX) {
      return json({ error: `Valor precisa ficar entre R$ ${VALOR_MIN} e R$ ${VALOR_MAX}.` }, 400);
    }
    if (!descricao) return json({ error: "Descreva o que está sendo cobrado." }, 400);

    // Arredonda para centavo: o Mercado Pago recusa comissão com mais casas.
    const comissao = Math.round(valor * COMISSAO * 100) / 100;

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        // Token DA LOJA, não o da plataforma: é isso que faz o dinheiro cair
        // na conta dela.
        Authorization: `Bearer ${conta.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ title: descricao, quantity: 1, currency_id: "BRL", unit_price: valor }],
        marketplace_fee: comissao,
        external_reference: `${perfil.store_id}|venda`,
        back_urls: {
          success: `${APP_URL}/obrigado`,
          pending: `${APP_URL}/obrigado`,
          failure: `${APP_URL}/obrigado`,
        },
        statement_descriptor: "VESTAI",
      }),
    });
    const pref = await res.json();
    if (!res.ok || !pref.init_point) {
      console.error("[mp-cobranca]", JSON.stringify(pref).slice(0, 300));
      return json({ error: pref?.message ?? "Não foi possível gerar a cobrança." }, 502);
    }

    return json({ url: pref.init_point, valor, comissao });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
