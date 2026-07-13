import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthService } from "@/services/AuthService";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nova senha — Vest IA" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      // A sessão de recuperação já está ativa (detectSessionInUrl do link).
      await AuthService.updatePassword(password);
      toast.success("Senha atualizada. Entre com a nova senha.");
      navigate({ to: "/login" });
    } catch {
      toast.error("Link expirado ou inválido. Peça um novo e-mail de recuperação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-14">
      <h1 className="font-display text-3xl font-semibold text-foreground">Definir nova senha</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Escolha uma nova senha para sua conta.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Nova senha
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
            placeholder="Mínimo 8 caracteres"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Confirmar senha
          </span>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
            placeholder="Repita a nova senha"
          />
        </label>

        <button
          disabled={busy}
          className="mt-2 w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
        >
          {busy ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>

      <p className="mt-auto pt-10 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-semibold text-clay">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
