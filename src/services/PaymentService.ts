// PaymentService — planos e compra de tokens via Mercado Pago (Edge Function
// `mercadopago-checkout`). O front só pede a preferência e redireciona; o
// crédito/plano é aplicado pelo webhook (`mercadopago-webhook`) com
// service_role. Sem os secrets configurados a função devolve erro e a UI trata.
//
// Mercado Pago e não Stripe porque o público é lojista brasileiro e boa parte
// paga em PIX — que o Checkout Pro faz junto com o cartão, na mesma tela.

import { supabase } from "@/integrations/supabase/client";
import type { PlanId } from "@/types";
import { PLANS } from "@/constants/plans";
import { TOKEN_PACKS } from "@/constants/tokens";

async function checkout(body: Record<string, unknown>): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("mercadopago-checkout", { body });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      const parsed = await ctx?.json?.();
      if (parsed?.error) detail = parsed.error;
    } catch {
      /* ignora */
    }
    throw new Error(detail || "Não foi possível iniciar o pagamento.");
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  const url = (data as { url?: string })?.url;
  if (!url) throw new Error("Checkout indisponível.");
  return { url };
}

export const PaymentService = {
  listPlans() {
    return PLANS;
  },
  listTokenPacks() {
    return TOKEN_PACKS;
  },
  async startPlanCheckout(planId: PlanId): Promise<{ url: string }> {
    return checkout({ kind: "plan", id: planId });
  },
  async startTokenPurchase(packId: string): Promise<{ url: string }> {
    return checkout({ kind: "tokens", id: packId });
  },

  // Confere o pagamento ao voltar do Mercado Pago e credita na hora
  // (idempotente). Resolve o CARTÃO; no PIX o cliente volta com o pagamento
  // ainda pendente e quem credita, minutos depois, é o webhook.
  async confirmCheckout(paymentId: string): Promise<{ credited: boolean; balance?: number }> {
    const { data, error } = await supabase.functions.invoke("mercadopago-checkout", {
      body: { action: "confirm", payment_id: paymentId },
    });
    if (error) throw new Error(error.message);
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as { credited: boolean; balance?: number };
  },
};
