import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { InviteService } from "@/services/InviteService";
import { ROLE_LABEL } from "@/constants/permissions";
import { describeAuthError } from "@/lib/authErrors";
import type { StoreSegment, UserRole } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEGMENT_OPTIONS: {
  id: StoreSegment;
  label: string;
  hint: string;
  dots: string[];
}[] = [
  { id: "feminina", label: "Feminino", hint: "Rosa & roxo", dots: ["var(--neon-pink)", "var(--neon-purple)"] },
  { id: "masculina", label: "Masculino", hint: "Azul & verde", dots: ["var(--neon-blue)", "var(--neon-green)"] },
  { id: "unissex", label: "Os dois", hint: "Roxo & azul", dots: ["var(--neon-purple)", "var(--neon-blue)"] },
];

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Criar conta — Vest IA" }] }),
  // ?invite=<token> = veio de um link de convite de funcionário (ver InviteService).
  // ?mode=invited = clicou em "Entrar com convite" (convite por E-MAIL, sem
  // token — o cadastro simplifica mas só liga à loja se o e-mail bater com
  // um convite pendente; ver handle_new_user, migration 0003).
  validateSearch: (search: Record<string, unknown>): { invite?: string; mode?: string } => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
    mode: typeof search.mode === "string" ? search.mode : undefined,
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { invite: inviteToken, mode } = Route.useSearch();
  const emailInviteMode = mode === "invited";
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [segment, setSegment] = useState<StoreSegment>("feminina");
  const [busy, setBusy] = useState(false);
  const [invitePreview, setInvitePreview] = useState<{ storeName: string; role: UserRole } | null>(
    null,
  );

  useEffect(() => {
    if (!inviteToken) return;
    InviteService.previewByToken(inviteToken)
      .then(setInvitePreview)
      .catch(() => setInvitePreview(null));
  }, [inviteToken]);

  const invited = !!invitePreview || emailInviteMode;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Aplica o tema escolhido imediatamente (o AppLayout mantém sincronizado).
      document.documentElement.dataset.segment = segment;
      const result = await signUp({
        storeName,
        ownerName: ownerName || undefined,
        email,
        password,
        cnpj: cnpj || undefined,
        segment,
        inviteToken,
      });
      // Decide pela Session REAL devolvida (não por uma suposição de antes do
      // envio): se o e-mail bateu com um convite (link OU e-mail), o trigger
      // liga a conta como funcionária de uma loja já existente — role vem
      // "manager"/"seller", não "owner". Só quem é owner de loja NOVA precisa
      // escolher plano.
      navigate({ to: result?.user.role === "owner" ? "/plans" : "/home" });
    } catch (err) {
      toast.error(describeAuthError(err, "Não foi possível criar a conta."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-14">
      <Link to="/welcome" className="text-sm text-muted-foreground">
        ← Voltar
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold text-foreground">
        {invited ? "Entrar na equipe" : "Criar conta da loja"}
      </h1>
      {invited ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Complete seu cadastro para começar a usar o Vest IA.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Comece com 7 dias de teste em qualquer plano.
        </p>
      )}

      {invitePreview ? (
        <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Convite de <strong>{invitePreview.storeName}</strong> — você vai entrar como{" "}
          <strong>{ROLE_LABEL[invitePreview.role]}</strong>.
        </p>
      ) : emailInviteMode ? (
        <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Cadastre-se com o <strong>mesmo e-mail</strong> que sua loja convidou — você entra direto
          na equipe dela, sem precisar criar uma loja nova.
        </p>
      ) : (
        <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Recebeu um convite? Cadastre-se com o <strong>mesmo e-mail</strong> convidado para entrar
          na loja existente como funcionário — neste caso o nome da loja é ignorado.
        </p>
      )}

      <form onSubmit={submit} className="mt-8 grid gap-4">
        <Field label="Seu nome">
          <input
            required
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
            placeholder="Marina Souza"
          />
        </Field>
        {invited ? null : (
          <>
            <Field label="Nome da loja">
              <input
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
                placeholder="Atelier Marina"
              />
            </Field>
            <Field label="Direcionamento da loja">
              <p className="-mt-0.5 mb-1 text-xs text-muted-foreground">
                Define as cores do app e o público das suas criações.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SEGMENT_OPTIONS.map((opt) => {
                  const active = opt.id === segment;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSegment(opt.id);
                        document.documentElement.dataset.segment = opt.id;
                      }}
                      aria-pressed={active}
                      className={cn(
                        "rounded-2xl border bg-card p-3 text-center transition",
                        active
                          ? "border-2 border-accent shadow-glow"
                          : "border-border hover:border-accent/50",
                      )}
                    >
                      <span className="flex justify-center gap-1">
                        {opt.dots.map((c) => (
                          <span
                            key={c}
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: c, boxShadow: `0 0 8px ${c}` }}
                          />
                        ))}
                      </span>
                      <span className="mt-2 block text-sm font-semibold text-foreground">
                        {opt.label}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="CNPJ (opcional)">
              <input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
                placeholder="00.000.000/0001-00"
              />
            </Field>
          </>
        )}
        <Field label="E-mail">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
            placeholder="voce@suamarca.com"
          />
        </Field>
        <Field label="Senha">
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
            placeholder="Mínimo 6 caracteres"
          />
        </Field>

        <button
          disabled={busy}
          className="mt-2 w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
        >
          {busy ? "Criando…" : "Continuar"}
        </button>
      </form>

      <p className="mt-auto pt-10 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="font-semibold text-clay">
          Entrar
        </Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
