import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Bell,
  BookImage,
  CreditCard,
  LogOut,
  Plus,
  Shirt,
  Sparkles,
  Users,
} from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { SectionTitle } from "@/components/SectionTitle";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { TokenService } from "@/services/TokenService";
import { getPlan } from "@/constants/plans";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configurações — StyleDesk" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { session, signOut } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  if (!session) return null;
  const plan = getPlan(session.store.planId);

  return (
    <AppLayout title="Configurações">
      <div className="space-y-7">
        <Link
          to="/profile"
          className="flex items-center justify-between rounded-3xl border border-border bg-card p-5"
        >
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Loja</p>
            <h2 className="mt-1 truncate font-display text-xl font-semibold">
              {session.store.name}
            </h2>
            <p className="mt-0.5 text-sm text-clay">Perfil e equipe da loja</p>
          </div>
          <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>

        <div className="grid grid-cols-1 gap-2">
          <SettingsLink to="/catalog" icon={Shirt} label="Catálogo" />
          <SettingsLink to="/clients" icon={Users} label="Clientes" />
          <SettingsLink to="/library" icon={BookImage} label="Biblioteca de imagens" />
        </div>

        <section className="space-y-3">
          <SectionTitle eyebrow="Plano" title="Assinatura" />
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-lg font-semibold">{plan.name}</p>
              <p className="text-sm text-muted-foreground">R$ {plan.priceBRL}/mês</p>
            </div>
            <p className="mt-1 text-sm text-clay">{plan.tokens} tokens/mês</p>
            {can("plan:change") ? (
              <button
                onClick={() => navigate({ to: "/plans" })}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium"
              >
                <CreditCard className="h-4 w-4" /> Alterar plano
              </button>
            ) : null}
          </div>
          {can("tokens:view") ? (
            <button
              onClick={() => toast.success("Em breve: compra de tokens avulsos.")}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left"
            >
              <span className="flex items-center gap-3">
                <Plus className="h-5 w-5 text-clay" />
                <span className="font-medium">Comprar tokens avulsos</span>
              </span>
              <span className="text-xs text-muted-foreground">em breve</span>
            </button>
          ) : null}
          {/* TEMPORÁRIO: crédito de teste (owner). A compra real virá com pagamentos. */}
          {session.user.role === "owner" ? (
            <button
              onClick={async () => {
                await TokenService.credit(100, "Crédito de teste");
                toast.success("+100 tokens de teste adicionados.");
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-dashed border-clay/50 bg-card p-4 text-left"
            >
              <span className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-clay" />
                <span className="font-medium">Adicionar 100 tokens (teste)</span>
              </span>
              <span className="text-xs text-muted-foreground">temporário</span>
            </button>
          ) : null}
        </section>

        <section className="space-y-2">
          <SectionTitle eyebrow="Preferências" title="Notificações" />
          <button className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left">
            <span className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-clay" />
              <span className="font-medium">Alertas de saldo</span>
            </span>
            <span className="text-xs text-muted-foreground">ativado</span>
          </button>
          <button className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left">
            <span className="flex items-center gap-3">
              <Users className="h-5 w-5 text-clay" />
              <span className="font-medium">Atividade da equipe</span>
            </span>
            <span className="text-xs text-muted-foreground">semanal</span>
          </button>
        </section>

        <button
          onClick={() => {
            signOut();
            navigate({ to: "/welcome" });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-medium text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </div>
    </AppLayout>
  );
}

function SettingsLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/catalog" | "/clients" | "/library";
  icon: typeof Users;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-clay" />
        <span className="font-medium">{label}</span>
      </span>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
