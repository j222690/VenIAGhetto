import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Criar conta — StyleDesk AI" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signUp({
        storeName,
        ownerName: ownerName || undefined,
        email,
        password,
        cnpj: cnpj || undefined,
      });
      navigate({ to: "/plans" });
    } catch {
      toast.error("Não foi possível criar a conta.");
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
        Criar conta da loja
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Comece com 7 dias de teste em qualquer plano.
      </p>
      <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
        Recebeu um convite? Cadastre-se com o <strong>mesmo e-mail</strong> convidado para entrar
        na loja existente como funcionário — neste caso o nome da loja é ignorado.
      </p>

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
        <Field label="Nome da loja">
          <input
            required
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
            placeholder="Atelier Marina"
          />
        </Field>
        <Field label="CNPJ (opcional)">
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
            placeholder="00.000.000/0001-00"
          />
        </Field>
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
            placeholder="Mínimo 8 caracteres"
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
