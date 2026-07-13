// PaymentService — planos e compra de tokens.
// trocar por Mercado Pago / Stripe via Edge Function.

import type { PlanId } from "@/types";
import { PLANS } from "@/constants/plans";

export const PaymentService = {
  listPlans() {
    return PLANS;
  },
  async startPlanCheckout(planId: PlanId): Promise<{ url: string }> {
    await new Promise((r) => setTimeout(r, 300));
    return { url: `#checkout/${planId}` };
  },
  async startTokenPurchase(packId: string): Promise<{ url: string }> {
    await new Promise((r) => setTimeout(r, 300));
    return { url: `#tokens/${packId}` };
  },
};
