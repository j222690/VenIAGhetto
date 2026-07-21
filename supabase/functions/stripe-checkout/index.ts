// Edge Function: stripe-checkout
// -----------------------------------------------------------------------------
// Duas ações (usuário autenticado):
//   • padrão { kind, id }  → cria a sessão de Checkout (plano com trial ou
//     pacote de tokens) e devolve { url }.
//   • { action:"confirm", session_id } → quando o cliente VOLTA do Stripe,
//     confere o pagamento e credita na hora (idempotente via processed_payments),
//     sem depender só do webhook. Devolve { credited, balance }.
//
// Secrets: STRIPE_SECRET_KEY, APP_URL, STRIPE_PRICE_STARTER|_PRO|_BUSINESS,
//          STRIPE_PRICE_TOKENS_100|_300|_1000
// -----------------------------------------------------------------------------
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PLAN_PRICE_ENV: Record<string, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  business: "STRIPE_PRICE_BUSINESS",
};
const PLAN_TOKENS: Record<string, number> = { starter: 149, pro: 303, business: 610 };
const TRIAL_BONUS = 25;
const PACK_PRICE_ENV: Record<string, string> = {
  pack_100: "STRIPE_PRICE_TOKENS_100",
  pack_300: "STRIPE_PRICE_TOKENS_300",
  pack_1000: "STRIPE_PRICE_TOKENS_1000",
};
const PACK_TOKENS: Record<string, number> = { pack_100: 75, pack_300: 198, pack_1000: 660 };

// Credita tokens com service_role (bypassa RLS) e registra a transação.
async function credit(storeId: string, amount: number): Promise<number> {
  if (!storeId || amount <= 0) {
    const { data } = await admin.from("stores").select("tokens_balance").eq("id", storeId).single();
    return data?.tokens_balance ?? 0;
  }
  const { data } = await admin.from("stores").select("tokens_balance").eq("id", storeId).single();
  const next = (data?.tokens_balance ?? 0) + amount;
  await admin.from("stores").update({ tokens_balance: next }).eq("id", storeId);
  await admin.from("token_transactions").insert({ store_id: storeId, type: "credit", amount });
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!STRIPE_SECRET_KEY) return json({ error: "Pagamentos ainda não configurados." }, 503);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    const { data: store } = await authed.from("stores").select("id").limit(1).maybeSingle();
    if (!store?.id) return json({ error: "Loja não encontrada." }, 400);

    const body = await req.json().catch(() => ({}));
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // --- Confirmação no retorno do Stripe (credita na hora, idempotente) ---
    if (body.action === "confirm" && body.session_id) {
      const session = await stripe.checkout.sessions.retrieve(String(body.session_id));
      const md = session.metadata ?? {};
      if ((md.store_id ?? session.client_reference_id) !== store.id) {
        return json({ error: "Sessão não pertence a esta loja." }, 403);
      }
      const paid = session.payment_status === "paid" || session.status === "complete";
      if (!paid) return json({ credited: false, status: session.status });

      // Trava de idempotência: só o primeiro a inserir credita.
      const { error: dupErr } = await admin
        .from("processed_payments")
        .insert({ session_id: session.id, store_id: store.id });
      if (dupErr) {
        const { data } = await admin.from("stores").select("tokens_balance").eq("id", store.id).single();
        return json({ credited: false, already: true, balance: data?.tokens_balance ?? 0 });
      }

      let balance = 0;
      if (md.kind === "tokens") {
        balance = await credit(store.id, Number(md.tokens ?? 0));
      } else if (md.kind === "plan" && md.plan) {
        await admin.from("stores").update({ plan: md.plan }).eq("id", store.id);
        balance = await credit(store.id, TRIAL_BONUS);
      }
      return json({ credited: true, balance });
    }

    // --- Criação da sessão de checkout ---
    const { kind, id } = body;
    const appUrl = APP_URL || req.headers.get("Origin") || "";
    const success_url = `${appUrl}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${appUrl}/plans?checkout=cancel`;

    if (kind === "plan") {
      const priceId = Deno.env.get(PLAN_PRICE_ENV[id] ?? "");
      if (!priceId) return json({ error: `Preço do plano '${id}' não configurado.` }, 400);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: 7,
          metadata: { store_id: store.id, plan: id },
        },
        success_url,
        cancel_url,
        client_reference_id: store.id,
        metadata: { store_id: store.id, kind: "plan", plan: id, tokens: String(PLAN_TOKENS[id] ?? 0) },
      });
      return json({ url: session.url });
    }

    if (kind === "tokens") {
      const priceId = Deno.env.get(PACK_PRICE_ENV[id] ?? "");
      if (!priceId) return json({ error: `Preço do pacote '${id}' não configurado.` }, 400);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url,
        cancel_url,
        client_reference_id: store.id,
        metadata: { store_id: store.id, kind: "tokens", tokens: String(PACK_TOKENS[id] ?? 0) },
      });
      return json({ url: session.url });
    }

    return json({ error: "Requisição inválida." }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
