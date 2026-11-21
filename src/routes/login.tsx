import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthService } from "@/services/AuthService";
import { describeAuthError, detalheAuthError } from "@/lib/authErrors";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    oauth: search.oauth === "1" || search.oauth === 1 || search.oauth === true ? ("1" as const) : undefined,
  }),
  head: () => ({ meta: [{ title: "Entrar — ProveON" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const { oauth } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Retorno do OAuth Google (/login?oauth=1): espera a sessão montar e manda
  // pro app, ou avisa se o Google autenticou mas a conta não tem loja.
  useEffect(() => {
    if (!oauth) return;
    if (loading) return;
    if (session) {
      navigate({ to: "/home" });
      return;
    }
    // Auth ok no Supabase às vezes, mas sem linha em public.users.
    void (async () => {
      try {
        const s = await AuthService.loadSession();
        if (s) {
          navigate({ to: "/home" });
          return;
        }
        toast.error(
          "Sua conta Google entrou, mas não está ligada a nenhuma loja. Peça um convite ou crie a conta da loja.",
          { duration: 10000 },
        );
      } catch (err) {
        toast.error(describeAuthError(err, "Não foi possível concluir o login com Google."), {
          description: detalheAuthError(err),
          duration: 9000,
        });
      }
    })();
  }, [oauth, loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(describeAuthError(err, "Não foi possível entrar."), {
        duration: 9000,
        description: detalheAuthError(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setGoogleBusy(true);
    try {
      await AuthService.signInWithGoogle();
      // O navegador redireciona para o Google; se voltar sem ir, cai no catch.
    } catch (err) {
      toast.error(describeAuthError(err, "Não foi possível conectar com o Google."), {
        description: detalheAuthError(err),
        duration: 9000,
      });
      setGoogleBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-[max(3.5rem,env(safe-area-inset-top))]">
      <Link to="/welcome" className="text-sm text-muted-foreground">
        ← Voltar
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold text-foreground">
        Entrar na sua loja
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Acesse o painel da sua marca.</p>

      {oauth && loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Concluindo login com Google…</p>
      ) : null}

      <form onSubmit={submit} className="mt-8 grid gap-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
            placeholder="••••••••"
          />
        </Field>

        <button
          type="button"
          onClick={async () => {
            const value = email.trim();
            if (!value) {
              toast.error("Digite seu e-mail acima primeiro.");
              return;
            }
            try {
              await AuthService.requestPasswordReset(value);
              toast.success("Enviamos um link de recuperação para seu e-mail.");
            } catch (err) {
              toast.error(
                describeAuthError(err, "Não foi possível enviar o e-mail. Tente novamente."),
              );
            }
          }}
          className="-mt-2 text-left text-sm text-muted-foreground hover:text-foreground"
        >
          Esqueci minha senha
        </button>

        <button
          disabled={busy}
          className="mt-2 w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        disabled={googleBusy}
        onClick={() => void google()}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-4 text-base font-semibold text-foreground shadow-soft disabled:opacity-60"
      >
        <GoogleMark />
        {googleBusy ? "Abrindo Google…" : "Entrar com Google"}
      </button>

      <p className="mt-auto pt-10 text-center text-sm text-muted-foreground">
        Sem conta?{" "}
        <Link to="/register" className="font-semibold text-clay">
          Criar agora
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Foi convidado por uma loja?{" "}
        <Link to="/register" search={{ mode: "invited" }} className="font-semibold text-clay">
          Entrar com convite
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

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.4 39.6 16.1 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l.1.1 6.3 5.2C39.2 37.3 44 32 44 24c0-1.3-.1-2.5-.4-3.5z" />
    </svg>
  );
}