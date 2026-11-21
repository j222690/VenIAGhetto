import { createFileRoute, Link } from "@tanstack/react-router";
import { Shirt, ScanLine, BookImage, History, Users, AlertTriangle } from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { FeatureCard } from "@/components/FeatureCard";
import { LookActions } from "@/components/LookActions";
import { SectionTitle } from "@/components/SectionTitle";
import { PushPrompt } from "@/components/PushPrompt";
import { TrialBanner } from "@/components/TrialBanner";
import { useTokens } from "@/hooks/useTokens";
import { GenerationService } from "@/services/GenerationService";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Início — ProveON" }] }),
  component: HomePage,
});

function HomePage() {
  const { session } = useAuth();
  const { balance, used, total, lowBalance } = useTokens();
  const recent = GenerationService.history().slice(0, 4);

  const remaining = Math.floor(balance / GenerationService.tryonCost(1));
  const pct = total > 0 ? Math.min(100, (balance / total) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        <section>
          <p className="text-sm text-muted-foreground">
            Olá, <span className="text-foreground">{session?.user.name.split(" ")[0]}</span>
          </p>
          <h1 className="mt-1 font-display text-[2rem] font-semibold leading-[1.1] tracking-tight text-foreground">
            Quem vamos vestir hoje?
          </h1>
        </section>

        <TrialBanner />

        <PushPrompt />

        {/* Ação principal em destaque: provar é o que o lojista faz no balcão.
            O saldo vem junto, compacto, em vez de um cartão maior que o botão. */}
        <section className="relative overflow-hidden rounded-3xl border border-clay/30 bg-card p-5 shadow-elevated">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-clay/15 blur-3xl"
          />
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-clay">
            Provador IA
          </p>
          <p className="mt-2 max-w-[18rem] text-sm text-muted-foreground">
            Escolha o cliente, a peça e veja o look vestido em segundos.
          </p>
          <Link
            to="/tryon"
            search={{ g: undefined }}
            className="mt-5 flex items-center justify-center gap-2 rounded-full bg-clay px-6 py-3.5 text-base font-semibold text-clay-foreground shadow-soft transition-transform active:scale-[0.98]"
          >
            <Shirt className="h-5 w-5" /> Provar agora
          </Link>
          <div className="mt-5 border-t border-border/70 pt-4">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Gerações este mês</span>
              <span className="font-medium text-foreground">
                {balance}
                <span className="text-muted-foreground"> / {total}</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-clay transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {remaining} provas restantes · {used} usadas. Provador, Refinar e Limpar peça contam 1
              cada.
            </p>
            {lowBalance ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-clay/10 p-3 text-sm text-clay">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Saldo abaixo de 20%. Considere recarregar.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle eyebrow="Ferramentas" title="Antes de provar" />
          <div className="grid grid-cols-2 gap-3">
            {/* Criar corpo fica junto do Provador porque é pré-requisito dele:
                a foto que o cliente manda quase sempre vem cortada. */}
            <FeatureCard
              to="/corpo"
              title="Corpo inteiro"
              description="Foto cortada? A IA completa as pernas."
              icon={Users}
            />
            <FeatureCard
              to="/scanner"
              title="Scanner"
              description="Ficha automática da peça."
              icon={ScanLine}
            />
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle
            eyebrow="Recentes"
            title="Últimas gerações"
            action={
              <Link to="/album" className="text-sm font-medium text-clay">
                Ver álbum
              </Link>
            }
          />
          {recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
              Nada por aqui ainda. Gere sua primeira prova.
            </p>
          ) : (
            <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
              {recent.map((g) => (
                <div
                  key={g.id}
                  className="w-[42%] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card lg:w-auto"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-secondary">
                    <img
                      src={g.resultUrl}
                      alt={g.type}
                      className="h-full w-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                    />
                    <LookActions
                      look={g}
                      actions={["favorite", "save", "download", "share"]}
                      className="absolute right-2 top-2"
                    />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {g.type === "tryon" ? "Provador" : g.type === "post" ? "Post" : "Scanner"}
                    </p>
                    <p className="truncate text-sm font-medium text-foreground">
                      {new Date(g.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <QuickLink to="/catalog" icon={Shirt} eyebrow="Loja" label="Catálogo" />
          <QuickLink to="/clients" icon={Users} eyebrow="Pessoas" label="Clientes" />
          <QuickLink to="/album" icon={BookImage} eyebrow="Acervo" label="Álbum" />
          <QuickLink to="/history" icon={History} eyebrow="Atividade" label="Histórico" />
        </section>
      </div>
    </AppLayout>
  );
}

function QuickLink({
  to,
  icon: Icon,
  eyebrow,
  label,
}: {
  to: "/catalog" | "/clients" | "/album" | "/history";
  icon: LucideIcon;
  eyebrow: string;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-clay/40 active:scale-[0.99]"
    >
      <Icon className="h-5 w-5 shrink-0 text-clay" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        <p className="truncate font-medium text-foreground">{label}</p>
      </div>
    </Link>
  );
}
