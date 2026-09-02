import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Sparkles } from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";
import { describeApiError } from "@/lib/apiErrors";
import { PLANS } from "@/constants/plans";
import { PaymentService } from "@/services/PaymentService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PlanId } from "@/types";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Escolha seu plano — Vest Ai" }] }),
  component: PlansPage,
});

function PlansPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { session } = useAuth();
  const [selected, setSelected] = useState<PlanId>("pro");
  const [busy, setBusy] = useState(false);

  // Quem acabou de se cadastrar cai aqui, e até agora a única saída era o
  // checkout — que pede cartão. Os 35 créditos do teste existiam no banco sem
  // nenhuma porta na tela: o lojista via "pague" e desistia. Enquanto o prazo
  // vale, o teste lidera a tela e os planos ficam para quem já decidiu.
  const fimTeste = session?.store.trialEndsAt;
  const emTeste = !!fimTeste && new Date(fimTeste).getTime() > Date.now();

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
      // Redireciona para o checkout do Stripe (assinatura, cobrada na hora —
      // o teste grátis é o de cima, sem cartão).
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
    <div className="mx-auto max-w-md px-6 pb-10 pt-[max(3rem,env(safe-area-inset-top))]">
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
        {emTeste
          ? "Teste sem compromisso ou assine agora. Cancele quando quiser."
          : "Cancele quando quiser."}
      </p>

      {emTeste && (
        <section className="mt-7 rounded-3xl border border-clay bg-clay/5 p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-clay text-clay-foreground shadow-soft">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold text-foreground">
                Teste grátis · 7 dias
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Você ganhou 35 gerações para experimentar. Sem cartão, sem cobrança.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/onboarding" })}
            className="mt-4 w-full rounded-full bg-clay px-6 py-3.5 text-base font-semibold text-clay-foreground shadow-soft"
          >
            Começar a usar agora
          </button>
        </section>
      )}

      <p className="mt-8 text-center text-sm font-medium text-muted-foreground">
        {emTeste ? "ou assine um plano" : "Escolha um plano"}
      </p>

      <div className="mt-4 grid gap-4">
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
        {busy ? "Redirecionando…" : "Assinar plano"}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Pagamento seguro via Stripe · cancele quando quiser.
      </p>
    </div>
  );
}
