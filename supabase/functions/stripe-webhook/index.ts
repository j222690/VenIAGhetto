// Edge Function: stripe-webhook
// -----------------------------------------------------------------------------
// Recebe os eventos do Stripe e aplica o resultado no banco com service_role:
//   • checkout.session.completed → credita tokens (pacote) e/ou define o plano
//     e credita os tokens mensais do plano.
//   • invoice.paid (renovação de assinatura) → recredita os tokens mensais.
//
// IMPORTANTE: deploy com verify_jwt DESLIGADO (o Stripe não manda JWT):
//   supabase functions deploy stripe-webhook --no-verify-jwt --project-ref <ref>
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// -----------------------------------------------------------------------------
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const PLAN_TOKENS: Record<string, number> = { starter: 200, pro: 450, business: 900 };
// Bônus liberado no início do trial (o total do plano só entra na 1ª fatura paga).
const TRIAL_BONUS = 25;

// Credita tokens no saldo da loja e registra a transação (service_role).
async function creditTokens(storeId: string, amount: number) {
  if (!storeId || amount <= 0) return;
  const { data } = await admin.from("stores").select("tokens_balance").eq("id", storeId).single();
  const next = (data?.tokens_balance ?? 0) + amount;
  await admin.from("stores").update({ tokens_balance: next }).eq("id", storeId);
  await admin.from("token_transactions").insert({ store_id: storeId, type: "credit", amount });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });
  if (!STRIPE_SECRET_KEY || !WEBHOOK_SECRET) {
    return new Response("Stripe não configurado", { status: 503 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
  } catch (e) {
    return new Response(`Assinatura inválida: ${(e as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const md = s.metadata ?? {};
      const storeId = md.store_id ?? (s.client_reference_id ?? "");
      // Trava de idempotência: se a confirmação-no-retorno já processou, pula.
      const { error: dupErr } = await admin
        .from("processed_payments")
        .insert({ session_id: s.id, store_id: storeId });
      if (!dupErr) {
        if (md.kind === "plan" && md.plan) {
          // Início do plano/trial: define o plano e libera só o bônus de trial.
          // O total mensal entra na 1ª fatura paga (invoice.paid, abaixo).
          await admin.from("stores").update({ plan: md.plan }).eq("id", storeId);
          await creditTokens(storeId, TRIAL_BONUS);
        } else if (md.kind === "tokens") {
          await creditTokens(storeId, Number(md.tokens ?? 0));
        }
      }
    } else if (event.type === "invoice.paid") {
      // Só credita os tokens mensais em fatura REALMENTE paga (> 0) — cobre o
      // fim do trial (1ª cobrança) e as renovações. Trial ($0) é ignorado.
      const inv = event.data.object as Stripe.Invoice;
      if ((inv.amount_paid ?? 0) > 0) {
        const storeId = (inv.subscription_details?.metadata?.store_id ??
          inv.metadata?.store_id ??
          "") as string;
        const plan = (inv.subscription_details?.metadata?.plan ??
          inv.metadata?.plan ??
          "") as string;
        if (storeId && plan && PLAN_TOKENS[plan]) {
          await creditTokens(storeId, PLAN_TOKENS[plan]);
        }
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(`Erro ao processar: ${(e as Error).message}`, { status: 500 });
  }
});
