import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthService } from "@/services/AuthService";
import { describeAuthError } from "@/lib/authErrors";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Vest IA" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(describeAuthError(err, "Não foi possível entrar."));
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
        Entrar na sua loja
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Acesse o painel da sua marca.
      </p>

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
              toast.error(describeAuthError(err, "Não foi possível enviar o e-mail. Tente novamente."));
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
