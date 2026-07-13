import { createFileRoute, Link } from "@tanstack/react-router";
import { Shirt, ScanLine, Sparkles, BookImage, History, Users, AlertTriangle } from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { FeatureCard } from "@/components/FeatureCard";
import { LookActions } from "@/components/LookActions";
import { SectionTitle } from "@/components/SectionTitle";
import { useTokens } from "@/hooks/useTokens";
import { GenerationService } from "@/services/GenerationService";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Início — Vest IA" }] }),
  component: HomePage,
});

function HomePage() {
  const { session } = useAuth();
  const { balance, used, total, lowBalance } = useTokens();
  const recent = GenerationService.history().slice(0, 4);

  return (
    <AppLayout>
      <div className="space-y-7">
        <section>
          <p className="text-sm text-muted-foreground">
            Olá, <span className="text-foreground">{session?.user.name.split(" ")[0]}</span>
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight text-foreground">
            O que vamos criar hoje?
          </h1>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Tokens este mês
            </p>
            <p className="text-xs text-muted-foreground">{used} usados</p>
          </div>
          <p className="mt-2 font-display text-4xl font-semibold text-foreground">
            {balance}
            <span className="ml-1 text-base font-normal text-muted-foreground">/ {total}</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-clay transition-all"
              style={{ width: `${total > 0 ? (balance / total) * 100 : 0}%` }}
            />
          </div>
          {lowBalance ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-clay/10 p-3 text-sm text-clay">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Saldo abaixo de 20% — considere recarregar.</p>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <SectionTitle eyebrow="Recursos" title="Crie com IA" />
          <FeatureCard
            to="/tryon"
            title="Provador IA"
            description="Vista a peça em qualquer modelo."
            icon={Shirt}
            accent
          />
          <div className="grid grid-cols-2 gap-3">
            <FeatureCard
              to="/scanner"
              title="Scanner"
              description="Ficha automática da peça."
              icon={ScanLine}
            />
            <FeatureCard
              to="/posts"
              title="Posts"
              description="Imagem + copy pronta."
              icon={Sparkles}
            />
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle
            eyebrow="Recentes"
            title="Suas últimas gerações"
            action={
              <Link to="/album" className="text-sm font-medium text-clay">
                Ver álbum
              </Link>
            }
          />
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada por aqui ainda — gere sua primeira imagem.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {recent.map((g) => (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-secondary">
                    <img src={g.resultUrl} alt={g.type} className="h-full w-full object-cover" />
                    <LookActions
                      look={g}
                      actions={["favorite", "save", "download", "share"]}
                      className="absolute right-2 top-2"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
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
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Icon className="h-5 w-5 shrink-0 text-clay" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        <p className="truncate font-medium text-foreground">{label}</p>
      </div>
    </Link>
  );
}
