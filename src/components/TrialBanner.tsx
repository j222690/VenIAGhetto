// Aviso do teste grátis de 7 dias, na tela inicial.
//
// Existe porque o teste é silencioso por natureza: o lojista recebe a cota
// diária e gasta, sem nunca saber que está num período limitado. Quando ela
// acabasse, ele encontraria "sem saldo" sem entender o motivo — e a decisão
// de assinar chegaria como surpresa ruim em vez de escolha informada.
//
// Some sozinho quando não há teste (assinante, ou loja anterior à migration
// 0027) e quando o teste já venceu — aí quem fala é a tela de planos.

import { Link } from "@tanstack/react-router";
import { Sparkles } from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";
import { useTokens } from "@/hooks/useTokens";

export function TrialBanner() {
  const { session } = useAuth();
  const { balance } = useTokens();

  const fim = session?.store.trialEndsAt;
  if (!fim) return null;

  const restanteMs = new Date(fim).getTime() - Date.now();
  if (restanteMs <= 0) return null;

  // Arredonda pra cima: faltando 6h ainda é "1 dia", não "0 dias".
  const dias = Math.ceil(restanteMs / (24 * 60 * 60 * 1000));

  return (
    <section className="rounded-3xl border border-clay/40 bg-clay/5 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-clay text-clay-foreground shadow-soft">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Teste grátis · {dias === 1 ? "último dia" : `${dias} dias restantes`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {balance > 0
              ? `Você ganhou 35 créditos para testar e ainda tem ${balance} ${balance === 1 ? "geração" : "gerações"}. Use como quiser durante o teste.`
              : "Seus créditos de teste acabaram. Assine um plano para continuar gerando."}
          </p>
          <Link
            to="/plans"
            className="mt-3 inline-block rounded-full bg-clay px-5 py-2.5 text-sm font-semibold text-clay-foreground shadow-soft"
          >
            Ver planos
          </Link>
        </div>
      </div>
    </section>
  );
}
