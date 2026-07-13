// PaymentService — planos e compra de tokens via Stripe (Edge Function
// `stripe-checkout`). O front só pede a sessão e redireciona; o crédito/plano é
// aplicado pelo webhook (`stripe-webhook`) com service_role. Enquanto o Stripe
// não estiver configurado (secrets), a função retorna erro e a UI trata.

import { supabase } from "@/integrations/supabase/client";
import type { PlanId } from "@/types";
import { PLANS } from "@/constants/plans";
import { TOKEN_PACKS } from "@/constants/tokens";

async function checkout(body: Record<string, unknown>): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("stripe-checkout", { body });
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

  // Confere o pagamento ao voltar do Stripe e credita na hora (idempotente).
  async confirmCheckout(sessionId: string): Promise<{ credited: boolean; balance?: number }> {
    const { data, error } = await supabase.functions.invoke("stripe-checkout", {
      body: { action: "confirm", session_id: sessionId },
    });
    if (error) throw new Error(error.message);
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as { credited: boolean; balance?: number };
  },
};
