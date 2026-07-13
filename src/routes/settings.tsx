import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookImage,
  CreditCard,
  FileText,
  LogOut,
  Plus,
  Shield,
  Shirt,
  Users,
} from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { SectionTitle } from "@/components/SectionTitle";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { StoreService } from "@/services/StoreService";
import { PaymentService } from "@/services/PaymentService";
import { getPlan } from "@/constants/plans";
import { TOKEN_PACKS } from "@/constants/tokens";
import type { StoreSegment } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configurações — Vest IA" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { session, signOut, refresh } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [showTokens, setShowTokens] = useState(false);

  // Ao voltar do Stripe (?checkout=success&session_id=...), confirma o pagamento
  // e credita na hora — não depende só do webhook. Depois limpa a URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    const sid = params.get("session_id");
    (async () => {
      try {
        if (sid) await PaymentService.confirmCheckout(sid);
        refresh();
        toast.success("Pagamento confirmado! Seu saldo já foi atualizado.");
      } catch {
        refresh();
        toast.success("Pagamento recebido. Se o saldo não atualizar, recarregue em instantes.");
      } finally {
        window.history.replaceState({}, "", "/settings");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {can("store:manage") ? (
          <StoreStyleSection
            current={session.store.segment}
            onChange={async (segment) => {
              // Feedback instantâneo do tema, depois persiste.
              document.documentElement.dataset.segment = segment;
              try {
                await StoreService.updateStore({ segment });
                refresh();
                toast.success(
                  segment === "feminina"
                    ? "Estilo feminino aplicado — rosa & roxo neon."
                    : "Estilo masculino aplicado — azul & verde neon.",
                );
              } catch {
                document.documentElement.dataset.segment = session.store.segment;
                toast.error("Não foi possível salvar o estilo da loja.");
              }
            }}
          />
        ) : null}

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
              onClick={() => setShowTokens(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left"
            >
              <span className="flex items-center gap-3">
                <Plus className="h-5 w-5 text-clay" />
                <span className="font-medium">Comprar tokens avulsos</span>
              </span>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ) : null}
        </section>

        {showTokens ? <TokenPacksSheet onClose={() => setShowTokens(false)} /> : null}

        <section className="space-y-2">
          <SectionTitle eyebrow="Sobre" title="Legal" />
          <Link
            to="/privacy"
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
          >
            <span className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-clay" />
              <span className="font-medium">Política de Privacidade</span>
            </span>
            <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
          <Link
            to="/terms"
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
          >
            <span className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-clay" />
              <span className="font-medium">Termos de Uso</span>
            </span>
            <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
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

// Folha de compra de tokens avulsos (redireciona ao checkout do Stripe).
function TokenPacksSheet({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (packId: string) => {
    setBusy(packId);
    try {
      const { url } = await PaymentService.startTokenPurchase(packId);
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pagamento indisponível no momento.");
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl bg-background p-5 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Comprar tokens</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">
            Fechar
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pagamento seguro via Stripe. Os tokens entram na hora após o pagamento.
        </p>
        <div className="mt-4 space-y-2">
          {TOKEN_PACKS.map((p) => (
            <button
              key={p.id}
              onClick={() => buy(p.id)}
              disabled={busy !== null}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left disabled:opacity-60"
            >
              <span>
                <span className="block font-semibold text-foreground">{p.label}</span>
                <span className="block text-xs text-muted-foreground">
                  R$ {p.priceBRL.toLocaleString("pt-BR")}
                </span>
              </span>
              <span className="text-sm font-medium text-clay">
                {busy === p.id ? "Abrindo…" : "Comprar"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Estilo da loja: alterna o esquema de cores neon (feminina/masculina).
function StoreStyleSection({
  current,
  onChange,
}: {
  current: StoreSegment;
  onChange: (segment: StoreSegment) => void | Promise<void>;
}) {
  const [saving, setSaving] = useState<StoreSegment | null>(null);

  const pick = async (segment: StoreSegment) => {
    if (segment === current || saving) return;
    setSaving(segment);
    try {
      await onChange(segment);
    } finally {
      setSaving(null);
    }
  };

  const options: {
    id: StoreSegment;
    label: string;
    hint: string;
    dots: string[];
  }[] = [
    {
      id: "feminina",
      label: "Feminina",
      hint: "Rosa & roxo",
      dots: ["var(--neon-pink)", "var(--neon-purple)"],
    },
    {
      id: "masculina",
      label: "Masculina",
      hint: "Azul & verde",
      dots: ["var(--neon-blue)", "var(--neon-green)"],
    },
    {
      id: "unissex",
      label: "Os dois",
      hint: "Roxo & azul",
      dots: ["var(--neon-purple)", "var(--neon-blue)"],
    },
  ];

  return (
    <section className="space-y-3">
      <SectionTitle eyebrow="Aparência" title="Estilo da loja" />
      <p className="-mt-1 text-sm text-muted-foreground">
        Define as cores neon do app conforme o público da sua loja.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = opt.id === current;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt.id)}
              aria-pressed={active}
              className={
                active
                  ? "rounded-3xl border-2 border-accent bg-card p-3 text-center shadow-glow transition"
                  : "rounded-3xl border border-border bg-card p-3 text-center transition hover:border-accent/50"
              }
            >
              <span className="flex justify-center gap-1">
                {opt.dots.map((c) => (
                  <span
                    key={c}
                    className="h-3 w-3 rounded-full"
                    style={{ background: c, boxShadow: `0 0 10px ${c}` }}
                  />
                ))}
              </span>
              <p className="mt-2 font-display text-base font-semibold text-foreground">
                {opt.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{opt.hint}</p>
              <p className="mt-1.5 text-[10px] font-medium text-clay">
                {saving === opt.id ? "Aplicando…" : active ? "Ativo" : "Usar"}
              </p>
            </button>
          );
        })}
      </div>
    </section>
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
