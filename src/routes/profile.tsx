import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Copy,
  Instagram,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
  UserPlus,
} from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { SectionTitle } from "@/components/SectionTitle";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { StoreService } from "@/services/StoreService";
import { UserService } from "@/services/UserService";
import { InviteService } from "@/services/InviteService";
import { ShareService } from "@/services/ShareService";
import { ROLE_LABEL } from "@/constants/permissions";
import type { StoreInvite, User, UserRole } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Perfil da Loja — Vest IA" }] }),
  component: ProfilePage,
});

interface StoreForm {
  name: string;
  description: string;
  location: string;
  contactPhone: string;
  contactEmail: string;
  instagram: string;
  logoUrl: string;
}

function ProfilePage() {
  const { session, refresh } = useAuth();
  const { can } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const store = session?.store;
  const canManage = can("store:manage");

  const [form, setForm] = useState<StoreForm>(() => ({
    name: store?.name ?? "",
    description: store?.description ?? "",
    location: store?.location ?? "",
    contactPhone: store?.contactPhone ?? "",
    contactEmail: store?.contactEmail ?? "",
    instagram: store?.instagram ?? "",
    logoUrl: store?.logoUrl ?? "",
  }));

  if (!session || !store) return null;

  const set =
    (key: keyof StoreForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const startEditing = () => {
    setForm({
      name: store.name ?? "",
      description: store.description ?? "",
      location: store.location ?? "",
      contactPhone: store.contactPhone ?? "",
      contactEmail: store.contactEmail ?? "",
      instagram: store.instagram ?? "",
      logoUrl: store.logoUrl ?? "",
    });
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await StoreService.updateStore({
        name: form.name.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        instagram: form.instagram.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
      });
      refresh();
      setEditing(false);
      toast.success("Perfil da loja atualizado.");
    } catch {
      toast.error("Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <AppLayout title="Editar perfil">
        <form onSubmit={save} className="space-y-4">
          <ProfileField label="Nome da loja">
            <Input value={form.name} onChange={set("name")} required placeholder="Atelier Marina" />
          </ProfileField>
          <ProfileField label="URL do logo">
            <Input value={form.logoUrl} onChange={set("logoUrl")} placeholder="https://…" />
          </ProfileField>
          <ProfileField label="Sobre a loja">
            <Textarea
              value={form.description}
              onChange={set("description")}
              placeholder="Conte a história e o estilo da sua loja…"
            />
          </ProfileField>
          <ProfileField label="Localização">
            <Input
              value={form.location}
              onChange={set("location")}
              placeholder="Cidade / endereço"
            />
          </ProfileField>
          <ProfileField label="Telefone">
            <Input
              value={form.contactPhone}
              onChange={set("contactPhone")}
              placeholder="(11) 99999-0000"
            />
          </ProfileField>
          <ProfileField label="E-mail de contato">
            <Input
              type="email"
              value={form.contactEmail}
              onChange={set("contactEmail")}
              placeholder="contato@suamarca.com"
            />
          </ProfileField>
          <ProfileField label="Instagram">
            <Input value={form.instagram} onChange={set("instagram")} placeholder="@suamarca" />
          </ProfileField>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-medium text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-full bg-clay px-6 py-3.5 text-sm font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Perfil da Loja">
      <div className="space-y-7">
        <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
          {store.logoUrl ? (
            <img
              src={store.logoUrl}
              alt={store.name}
              className="mx-auto h-20 w-20 rounded-2xl object-cover"
            />
          ) : (
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-secondary">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">{store.name}</h2>
          {store.description ? (
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {store.description}
            </p>
          ) : null}
          {canManage ? (
            <button
              onClick={startEditing}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
            >
              <Pencil className="h-4 w-4" /> Editar perfil
            </button>
          ) : null}
        </section>

        <section className="space-y-3">
          <SectionTitle eyebrow="Contato" title="Como falar com a loja" />
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <ContactRow
              icon={<MapPin className="h-5 w-5 text-clay" />}
              value={store.location}
              empty="Localização não informada"
            />
            <ContactRow
              icon={<Phone className="h-5 w-5 text-clay" />}
              value={store.contactPhone}
              empty="Telefone não informado"
              border
            />
            <ContactRow
              icon={<Mail className="h-5 w-5 text-clay" />}
              value={store.contactEmail}
              empty="E-mail não informado"
              border
            />
            <ContactRow
              icon={<Instagram className="h-5 w-5 text-clay" />}
              value={store.instagram}
              empty="Instagram não informado"
              border
            />
          </div>
        </section>

        <TeamSection currentUserId={session.user.id} />
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Equipe (staff): membros que fazem login + convites pendentes.
// owner/manager (perm "users:manage") podem convidar, revogar, mudar papel e
// remover. Vendedor só visualiza. (Clientes ficam em /clients.)
// ---------------------------------------------------------------------------
function TeamSection({ currentUserId }: { currentUserId: string }) {
  const { can } = usePermissions();
  const canManage = can("users:manage");

  const [members, setMembers] = useState<User[]>(UserService.list());
  const [invites, setInvites] = useState<StoreInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("seller");
  const [busy, setBusy] = useState(false);
  const [linkRole, setLinkRole] = useState<UserRole>("seller");
  const [linkBusy, setLinkBusy] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    InviteService.load()
      .then((list) => active && setInvites(list))
      .catch(() => {
        // store_invites pode não existir antes da migration 0003 — silencioso.
      });
    return () => {
      active = false;
    };
  }, [canManage]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    if (members.some((m) => m.email.toLowerCase() === value)) {
      toast.error("Esse e-mail já é membro da equipe.");
      return;
    }
    setBusy(true);
    try {
      const invite = await InviteService.createInvite(value, role);
      setInvites((prev) => [invite, ...prev.filter((i) => i.email !== invite.email)]);
      setEmail("");
      toast.success("Convite criado. O acesso é liberado quando essa pessoa se cadastrar.");
    } catch {
      toast.error("Não foi possível criar o convite.");
    } finally {
      setBusy(false);
    }
  };

  const createLink = async () => {
    setLinkBusy(true);
    try {
      const invite = await InviteService.createLinkInvite(linkRole);
      setInvites((prev) => [invite, ...prev]);
      toast.success("Link de convite criado.");
    } catch {
      toast.error("Não foi possível criar o link.");
    } finally {
      setLinkBusy(false);
    }
  };

  const copyLink = async (invite: StoreInvite) => {
    try {
      await navigator.clipboard.writeText(InviteService.linkFor(invite));
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const shareLinkWhatsApp = (invite: StoreInvite) => {
    const text = `Você foi convidado(a) para a equipe da loja! Entre pelo link: ${InviteService.linkFor(invite)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const shareLink = async (invite: StoreInvite) => {
    const url = InviteService.linkFor(invite);
    const result = await ShareService.share({
      title: "Convite para a equipe",
      text: "Você foi convidado(a) para a equipe da loja no Vest IA.",
      url,
    });
    if (result === "copied") toast.success("Link copiado.");
  };

  const revoke = async (id: string) => {
    try {
      await InviteService.revokeInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
      toast.success("Convite revogado.");
    } catch {
      toast.error("Não foi possível revogar o convite.");
    }
  };

  const changeRole = async (user: User, next: UserRole) => {
    try {
      await UserService.updateRole(user.id, next);
      setMembers((prev) => prev.map((m) => (m.id === user.id ? { ...m, role: next } : m)));
      toast.success(`${user.name} agora é ${ROLE_LABEL[next]}.`);
    } catch {
      toast.error("Não foi possível alterar o cargo.");
    }
  };

  const removeMember = async (user: User) => {
    try {
      await UserService.remove(user.id);
      setMembers((prev) => prev.filter((m) => m.id !== user.id));
      toast.success(`${user.name} removido da equipe.`);
    } catch {
      toast.error("Não foi possível remover o membro.");
    }
  };

  return (
    <section className="space-y-3">
      <SectionTitle eyebrow="Equipe" title="Quem faz login e usa o app" />

      {canManage ? (
        <form onSubmit={sendInvite} className="rounded-3xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Convidar funcionário</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            O convidado entra na loja ao se cadastrar com este e-mail — antes disso fica pendente.
          </p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@pessoa.com"
              className="min-w-0 rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-clay"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-clay"
            >
              <option value="seller">Vendedor</option>
              <option value="manager">Gerente</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-clay px-4 py-2.5 text-sm font-semibold text-clay-foreground disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" /> {busy ? "Convidando…" : "Convidar"}
          </button>
        </form>
      ) : null}

      {canManage ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Convidar por link</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gere um link e mande por WhatsApp ou Instagram — quem abrir e se cadastrar já entra na
            loja, sem precisar saber o e-mail antes.
          </p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <select
              value={linkRole}
              onChange={(e) => setLinkRole(e.target.value as UserRole)}
              className="min-w-0 rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-clay"
            >
              <option value="seller">Vendedor</option>
              <option value="manager">Gerente</option>
            </select>
            <button
              type="button"
              onClick={createLink}
              disabled={linkBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground disabled:opacity-60"
            >
              <Link2 className="h-4 w-4" /> {linkBusy ? "Gerando…" : "Gerar link"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {members.map((u, i) => {
          const isSelf = u.id === currentUserId;
          const isOwner = u.role === "owner";
          const editable = canManage && !isOwner && !isSelf;
          return (
            <div
              key={u.id}
              className={
                i > 0
                  ? "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-border p-4"
                  : "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4"
              }
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
                {u.name[0]}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {u.name}
                  {isSelf ? <span className="text-muted-foreground"> (você)</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              {editable ? (
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value as UserRole)}
                    className="rounded-full border border-input bg-card px-2.5 py-1 text-[11px] font-medium outline-none focus:border-clay"
                  >
                    <option value="seller">Vendedor</option>
                    <option value="manager">Gerente</option>
                  </select>
                  <button
                    type="button"
                    aria-label={`Remover ${u.name}`}
                    onClick={() => removeMember(u)}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                  {ROLE_LABEL[u.role]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {canManage && invites.length > 0 ? (
        <div className="overflow-hidden rounded-3xl border border-dashed border-border bg-card">
          <p className="border-b border-border px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">
            Convites pendentes
          </p>
          {invites.map((inv) => (
            <div key={inv.id} className="border-t border-border p-4 first:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                    {inv.email ?? (
                      <>
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-clay" /> Convite por link
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABEL[inv.role]} · aguardando cadastro
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(inv.id)}
                  className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-destructive hover:text-destructive"
                >
                  Revogar
                </button>
              </div>
              {inv.email ? null : (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(inv)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() => shareLinkWhatsApp(inv)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </button>
                  {ShareService.canShare() ? (
                    <button
                      type="button"
                      onClick={() => shareLink(inv)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
                    >
                      <Instagram className="h-3.5 w-3.5" /> Compartilhar
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ContactRow({
  icon,
  value,
  empty,
  border,
}: {
  icon: React.ReactNode;
  value?: string;
  empty: string;
  border?: boolean;
}) {
  return (
    <div
      className={
        border
          ? "flex items-center gap-3 border-t border-border p-4"
          : "flex items-center gap-3 p-4"
      }
    >
      <span className="shrink-0">{icon}</span>
      <p
        className={
          value ? "truncate text-sm text-foreground" : "truncate text-sm text-muted-foreground"
        }
      >
        {value || empty}
      </p>
    </div>
  );
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className="w-full resize-none rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
    />
  );
}
