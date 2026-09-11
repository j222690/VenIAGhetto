// Edge Function: mercadopago-checkout
// -----------------------------------------------------------------------------
// Duas ações (usuário autenticado):
//   • padrão { kind, id }  → cria o checkout e devolve { url }.
//   • { action:"confirm", payment_id } → quando o cliente VOLTA do Mercado
//     Pago, confere o pagamento e credita na hora (idempotente), sem depender
//     só do webhook. Devolve { credited, balance, status }.
//
// DOIS CAMINHOS, PORQUE SÃO DUAS COISAS DIFERENTES
//   • plano  → ASSINATURA (preapproval). Renova sozinha todo mês; é o que
//     evita o lojista ficar sem crédito por esquecer de pagar.
//   • pacote → COMPRA ÚNICA (preference / Checkout Pro). Crédito avulso não
//     tem por que recorrer, e aqui o PIX entra sem ressalva.
//
// Sobre PIX no plano: a assinatura do Mercado Pago cobra no cartão. Se a conta
// já tiver Pix Automático liberado, ele aparece no próprio checkout do MP —
// nada a mudar aqui. Quem quiser pagar o mês no PIX sem assinar usa o pacote
// de créditos, que é compra única.
//
// PREÇO VEM DAQUI, NUNCA DO CLIENTE. O corpo manda só o id do plano/pacote; o
// valor sai da tabela abaixo. Confiar no preço enviado deixaria qualquer um
// comprar o Business por um real.
//
// Secrets: MP_ACCESS_TOKEN, APP_URL
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const MP_API = "https://api.mercadopago.com";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Espelha src/constants/plans.ts e src/constants/tokens.ts. Duplicado de
// propósito: o servidor não importa código do cliente, e é ele quem decide
// quanto cobrar e quanto creditar.
const PLANOS: Record<string, { titulo: string; preco: number; tokens: number }> = {
  starter: { titulo: "Vest Ai — Starter", preco: 97, tokens: 149 },
  pro: { titulo: "Vest Ai — Pro", preco: 197, tokens: 303 },
  business: { titulo: "Vest Ai — Business", preco: 397, tokens: 610 },
};
const PACOTES: Record<string, { titulo: string; preco: number; tokens: number }> = {
  pack_100: { titulo: "Vest Ai — 75 gerações", preco: 49, tokens: 75 },
  pack_300: { titulo: "Vest Ai — 198 gerações", preco: 129, tokens: 198 },
  pack_1000: { titulo: "Vest Ai — 660 gerações", preco: 429, tokens: 660 },
};

// A referência externa é o único campo que volta em TUDO — pagamento avulso,
// assinatura e cobrança mensal. Por isso ela carrega o que o webhook precisa
// saber, em vez de depender de metadata (que a assinatura não transporta).
export const refDe = (storeId: string, kind: string, id: string) => `${storeId}|${kind}|${id}`;
const leRef = (ref: string) => {
  const [storeId = "", kind = "", id = ""] = String(ref ?? "").split("|");
  return { storeId, kind, id };
};

async function mp(caminho: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${MP_API}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${MP_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A mensagem do MP vem em `message`; sem isso a tela mostraria só "500".
    throw new Error(
      (corpo as { message?: string })?.message ?? `Mercado Pago respondeu ${res.status}`,
    );
  }
  return corpo as Record<string, unknown>;
}

// Credita tokens com service_role (bypassa RLS) e registra a transação.
async function credita(storeId: string, amount: number): Promise<number> {
  const { data } = await admin.from("stores").select("tokens_balance").eq("id", storeId).single();
  const atual = data?.tokens_balance ?? 0;
  if (!storeId || amount <= 0) return atual;
  const next = atual + amount;
  await admin.from("stores").update({ tokens_balance: next }).eq("id", storeId);
  await admin.from("token_transactions").insert({ store_id: storeId, type: "credit", amount });
  return next;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!MP_TOKEN) return json({ error: "Pagamentos ainda não configurados." }, 503);

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
    const appUrl = APP_URL || req.headers.get("Origin") || "";

    // --- Confirmação no retorno (credita na hora, idempotente) ---------------
    //
    // Só resolve CARTÃO à vista. No PIX o cliente volta com o pagamento ainda
    // "pending" — a aprovação chega depois, e quem credita é o webhook.
    if (body.action === "confirm" && body.payment_id) {
      const pagamento = await mp(`/v1/payments/${String(body.payment_id)}`);
      const { storeId, kind, id } = leRef(String(pagamento.external_reference ?? ""));
      if (storeId !== store.id) {
        return json({ error: "Pagamento não pertence a esta loja." }, 403);
      }
      if (pagamento.status !== "approved") {
        return json({ credited: false, status: pagamento.status });
      }

      const { error: dupErr } = await admin
        .from("processed_payments")
        .insert({ session_id: `mp_${pagamento.id}`, store_id: store.id });
      if (dupErr) {
        const { data } = await admin
          .from("stores")
          .select("tokens_balance")
          .eq("id", store.id)
          .single();
        return json({ credited: false, already: true, balance: data?.tokens_balance ?? 0 });
      }

      const tabela = kind === "plan" ? PLANOS : PACOTES;
      const item = tabela[id];
      if (kind === "plan" && item) {
        await admin.from("stores").update({ plan: id }).eq("id", store.id);
      }
      const balance = await credita(store.id, item?.tokens ?? 0);
      return json({ credited: true, balance });
    }

    const { kind, id } = body;

    // --- Plano: ASSINATURA ---------------------------------------------------
    if (kind === "plan") {
      const plano = PLANOS[id];
      if (!plano) return json({ error: "Plano inválido." }, 400);

      const assinatura = await mp("/preapproval", {
        method: "POST",
        body: JSON.stringify({
          reason: plano.titulo,
          external_reference: refDe(store.id, "plan", id),
          // O MP exige o e-mail do pagador na criação da assinatura.
          payer_email: user.email,
          back_url: `${appUrl}/settings?checkout=assinatura`,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: plano.preco,
            currency_id: "BRL",
          },
          // "pending": quem autoriza é o lojista, no checkout do MP. Criar como
          // "authorized" exigiria um token de cartão que este fluxo não tem.
          status: "pending",
        }),
      });

      // Guarda a assinatura antes de mandar o lojista para o MP: se ele
      // autorizar e o webhook chegar primeiro, a linha já existe para casar.
      await admin.from("subscriptions").insert({
        store_id: store.id,
        plan: id,
        status: "trialing",
        payment_ref: String(assinatura.id ?? ""),
      });

      return json({ url: assinatura.init_point });
    }

    // --- Pacote de créditos: COMPRA ÚNICA -----------------------------------
    if (kind === "tokens") {
      const pacote = PACOTES[id];
      if (!pacote) return json({ error: "Pacote inválido." }, 400);

      const pref = await mp("/checkout/preferences", {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              id,
              title: pacote.titulo,
              quantity: 1,
              currency_id: "BRL",
              unit_price: pacote.preco,
            },
          ],
          external_reference: refDe(store.id, "tokens", id),
          back_urls: {
            success: `${appUrl}/settings?checkout=success`,
            pending: `${appUrl}/settings?checkout=pending`,
            failure: `${appUrl}/settings?checkout=cancel`,
          },
          auto_return: "approved",
          statement_descriptor: "VESTAI",
        }),
      });
      return json({ url: pref.init_point });
    }

    return json({ error: "Requisição inválida." }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
