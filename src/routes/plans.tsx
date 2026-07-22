import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check } from "@/lib/icons";
import { describeApiError } from "@/lib/apiErrors";
import { PLANS } from "@/constants/plans";
import { PaymentService } from "@/services/PaymentService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PlanId } from "@/types";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Escolha seu plano — Vest IA" }] }),
  component: PlansPage,
});

function PlansPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [selected, setSelected] = useState<PlanId>("pro");
  const [busy, setBusy] = useState(false);

  // Volta para a tela anterior real (cadastro no onboarding, ou Configurações
  // quando aberto por lá). Fallback: Início, caso não haja histórico.
  const goBack = () => {
    if (router.history.canGoBack()) router.history.back();
    else navigate({ to: "/home" });
  };

  const start = async () => {
    setBusy(true);
    try {
      const { url } = await PaymentService.startPlanCheckout(selected);
      // Redireciona para o checkout do Stripe (assinatura com 7 dias de trial).
      window.location.href = url;
    } catch (e) {
      // Stripe ainda não configurado: segue o onboarding para não travar o fluxo.
      toast.error(describeApiError(e, "Pagamento indisponível no momento."));
      navigate({ to: "/onboarding" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 pb-10 pt-12">
      <button
        onClick={goBack}
        className="-ml-1 mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <p className="text-[11px] uppercase tracking-[0.25em] text-clay">Planos</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">
        Escolha o ritmo da sua loja
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Comece com 7 dias grátis. Cancele quando quiser.
      </p>

      <div className="mt-8 grid gap-4">
        {PLANS.map((plan) => {
          const active = selected === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={cn(
                "rounded-3xl border p-5 text-left transition-all",
                active
                  ? "border-clay bg-clay/5 shadow-soft"
                  : "border-border bg-card hover:border-clay/40",
              )}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-semibold text-foreground">{plan.name}</h2>
                <p className="text-right">
                  <span className="font-display text-2xl font-semibold text-foreground">
                    R$ {plan.priceBRL}
                  </span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </p>
              </div>
              <p className="mt-1 text-sm text-clay">{plan.tokens} gerações/mês</p>
              <ul className="mt-4 grid gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <button
        onClick={start}
        disabled={busy}
        className="mt-8 w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
      >
        {busy ? "Redirecionando…" : "Começar trial gratuito"}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Pagamento seguro via Stripe · 7 dias grátis, cancele quando quiser.
      </p>
    </div>
  );
}
