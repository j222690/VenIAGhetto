// Edge Function: mercadopago-webhook
// -----------------------------------------------------------------------------
// Recebe as notificações do Mercado Pago e aplica o resultado com service_role.
//
// TRÊS AVISOS INTERESSAM, e são coisas diferentes:
//   • payment                        → compra única de pacote de créditos.
//   • subscription_preapproval       → a assinatura mudou de estado (o lojista
//     autorizou, pausou ou cancelou). Define o plano da loja.
//   • subscription_authorized_payment→ a cobrança do mês saiu. É ESTE o evento
//     do dinheiro na assinatura, e o único lugar que credita os créditos
//     mensais — tanto na primeira cobrança quanto nas renovações.
//
// É AQUI que o PIX se resolve. No cartão o cliente volta com o pagamento já
// aprovado e a tela credita na hora; no PIX ele volta com "pending" e a
// aprovação chega minutos depois — só por este caminho.
//
// O MP NÃO MANDA O RECURSO, MANDA O ID. Diferente do Stripe, o corpo traz
// `data.id` e nada de confiável além disso; o estado real é buscado na API.
// Isso é bom: nada do que chega pela rede decide crédito.
//
// ASSINATURA DO WEBHOOK. O cabeçalho `x-signature` traz ts e v1; o v1 é um
// HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com o
// segredo do webhook. Sem MP_WEBHOOK_SECRET a função RECUSA — um webhook que
// dá saldo sem verificar é um endereço público que credita quem chamar.
//
// IMPORTANTE: deploy com verify_jwt DESLIGADO (o MP não manda JWT):
//   supabase functions deploy mercadopago-webhook --no-verify-jwt --project-ref <ref>
//
// Secrets: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Mesma tabela da função de checkout, pela mesma razão: o servidor é quem
// decide quanto creditar.
const PLANO_TOKENS: Record<string, number> = { starter: 149, pro: 303, business: 610 };
const PACOTE_TOKENS: Record<string, number> = { pack_100: 75, pack_300: 198, pack_1000: 660 };

const leRef = (ref: unknown) => {
  const [storeId = "", kind = "", id = ""] = String(ref ?? "").split("|");
  return { storeId, kind, id };
};

async function mpGet(caminho: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://api.mercadopago.com${caminho}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

async function assinaturaConfere(req: Request, dataId: string): Promise<boolean> {
  const assinatura = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(
    assinatura.split(",").map((p) => {
      const [k, ...resto] = p.split("=");
      return [k.trim(), resto.join("=").trim()];
    }),
  );
  const ts = partes.ts ?? "";
  const v1 = partes.v1 ?? "";
  if (!ts || !v1) return false;

  // O id entra em minúsculas no manifesto — ids alfanuméricos (os da
  // assinatura são) falham a conferência se mandados como vieram.
  const manifesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(manifesto));
  const esperado = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // Comparação de tempo constante: comparar com === vaza, pelo tempo, quantos
  // caracteres iniciais o atacante acertou.
  if (esperado.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

async function creditaTokens(storeId: string, amount: number) {
  if (!storeId || amount <= 0) return;
  const { data } = await admin.from("stores").select("tokens_balance").eq("id", storeId).single();
  const next = (data?.tokens_balance ?? 0) + amount;
  await admin.from("stores").update({ tokens_balance: next }).eq("id", storeId);
  await admin.from("token_transactions").insert({ store_id: storeId, type: "credit", amount });
}

/** Trava de idempotência: devolve true só para quem chegou primeiro. */
async function primeiraVez(chave: string, storeId: string): Promise<boolean> {
  const { error } = await admin
    .from("processed_payments")
    .insert({ session_id: chave, store_id: storeId });
  return !error;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });
  if (!MP_TOKEN || !MP_WEBHOOK_SECRET) {
    return new Response("Mercado Pago não configurado", { status: 503 });
  }

  const corpo = await req.json().catch(() => ({}));
  const tipo = String(corpo?.type ?? corpo?.topic ?? "");
  const dataId = String(corpo?.data?.id ?? corpo?.resource ?? "");
  const ok = (extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ received: true, ...extra }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const tratados = ["payment", "subscription_preapproval", "subscription_authorized_payment"];
  // Responder 200 nos outros evita o MP reenviar a vida toda uma notificação
  // que a gente nunca vai usar.
  if (!tratados.includes(tipo) || !dataId) return ok({ ignored: tipo });

  if (!(await assinaturaConfere(req, dataId))) {
    return new Response("Assinatura inválida", { status: 401 });
  }

  try {
    // --- Compra única de pacote de créditos ---------------------------------
    if (tipo === "payment") {
      const pagamento = await mpGet(`/v1/payments/${dataId}`);
      if (!pagamento) return new Response("Pagamento não encontrado", { status: 404 });
      if (pagamento.status !== "approved") return ok({ status: pagamento.status });

      const { storeId, kind, id } = leRef(pagamento.external_reference);
      // Cobrança de assinatura também chega como "payment"; ela é creditada
      // pelo aviso de subscription_authorized_payment, que é o que sabe qual
      // mês está sendo pago. Creditar aqui também daria em dobro.
      if (!storeId || kind !== "tokens") return ok({ skipped: kind || "sem referência" });

      if (await primeiraVez(`mp_${pagamento.id}`, storeId)) {
        await creditaTokens(storeId, PACOTE_TOKENS[id] ?? 0);
      }
      return ok({ status: "approved" });
    }

    // --- A assinatura mudou de estado ---------------------------------------
    if (tipo === "subscription_preapproval") {
      const assinatura = await mpGet(`/preapproval/${dataId}`);
      if (!assinatura) return new Response("Assinatura não encontrada", { status: 404 });
      const { storeId, kind, id } = leRef(assinatura.external_reference);
      if (!storeId || kind !== "plan") return ok({ skipped: "sem referência" });

      const estado = String(assinatura.status ?? "");
      const mapa: Record<string, string> = {
        authorized: "active",
        paused: "past_due",
        cancelled: "canceled",
        pending: "trialing",
      };
      await admin
        .from("subscriptions")
        .update({ status: mapa[estado] ?? "trialing", plan: id })
        .eq("payment_ref", dataId);

      // O plano da loja só entra quando a assinatura é autorizada. No
      // cancelamento ele NÃO sai na hora: o mês já foi pago, e cortar o acesso
      // no mesmo instante tiraria algo que a pessoa comprou.
      if (estado === "authorized") {
        await admin.from("stores").update({ plan: id }).eq("id", storeId);
      }
      return ok({ estado });
    }

    // --- A cobrança do mês saiu (primeira e renovações) ---------------------
    const cobranca = await mpGet(`/authorized_payments/${dataId}`);
    if (!cobranca) return new Response("Cobrança não encontrada", { status: 404 });
    // "processed" é o que significa cobrado; "recycling"/"scheduled" ainda não.
    if (cobranca.status !== "processed") return ok({ status: cobranca.status });

    const assinatura = await mpGet(`/preapproval/${String(cobranca.preapproval_id ?? "")}`);
    const { storeId, kind, id } = leRef(assinatura?.external_reference);
    if (!storeId || kind !== "plan") return ok({ skipped: "sem referência" });

    // Trava pelo id da COBRANÇA: o MP reenvia quando não recebe 2xx, e sem
    // isso a segunda entrega creditaria o mês de novo.
    if (await primeiraVez(`mpsub_${dataId}`, storeId)) {
      await admin.from("stores").update({ plan: id }).eq("id", storeId);
      await creditaTokens(storeId, PLANO_TOKENS[id] ?? 0);
      await admin
        .from("subscriptions")
        .update({ status: "active", next_billing: cobranca.next_payment_date ?? null })
        .eq("payment_ref", String(cobranca.preapproval_id ?? ""));
    }
    return ok({ status: "processed" });
  } catch (e) {
    return new Response(`Erro ao processar: ${(e as Error).message}`, { status: 500 });
  }
});
