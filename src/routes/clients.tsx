import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookImage, Instagram, Pencil, Phone, Plus, Search, Trash2 } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LookActions } from "@/components/LookActions";
import { ClientService } from "@/services/ClientService";
import { usePermissions } from "@/hooks/usePermissions";
import type { Client, Generation } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/clients")({
  head: () => ({ meta: [{ title: "Clientes — Vest IA" }] }),
  // ?client=<id> abre direto a pasta daquele cliente (usado pelo Provador).
  validateSearch: (search: Record<string, unknown>): { client?: string } => ({
    client: typeof search.client === "string" ? search.client : undefined,
  }),
  component: ClientsPage,
});

interface ClientForm {
  name: string;
  instagram: string;
  phone: string;
  notes: string;
  photoUrl: string;
}

const EMPTY_FORM: ClientForm = { name: "", instagram: "", phone: "", notes: "", photoUrl: "" };

// Clientes = pessoas que a loja ATENDE e não fazem login. Toda a equipe
// adiciona/edita (ver ClientService / RLS por loja na migration 0003);
// EXCLUIR é só do dono (permissão `clients:delete`, RLS na 0018).
function ClientsPage() {
  const { can } = usePermissions();
  const canDelete = can("clients:delete");
  const { client: clientParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [clients, setClients] = useState<Client[]>(ClientService.list());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // null = só lista; "new" = criando; Client = editando.
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  // Pasta do cliente (galeria das imagens geradas para ele).
  const [viewing, setViewing] = useState<Client | null>(null);

  useEffect(() => {
    let active = true;
    ClientService.load()
      .then((list) => {
        if (!active) return;
        setClients(list);
        // Veio do Provador com ?client=<id> → abre a pasta dele direto.
        if (clientParam) {
          const target = list.find((c) => c.id === clientParam);
          if (target) setViewing(target);
        }
      })
      .catch(() => {
        // clients pode não existir antes da migration 0003 — segue vazio.
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [clientParam]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, query]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing("new");
  };

  const openEdit = (c: Client) => {
    setForm({
      name: c.name,
      instagram: c.instagram ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
      photoUrl: c.photoUrl ?? "",
    });
    setEditing(c);
  };

  const set =
    (key: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const input = {
        name: form.name,
        instagram: form.instagram || null,
        phone: form.phone || null,
        notes: form.notes || null,
        photoUrl: form.photoUrl || null,
      };
      if (editing === "new") {
        await ClientService.addClient(input);
        toast.success("Cliente adicionado.");
      } else if (editing) {
        await ClientService.updateClient(editing.id, input);
        toast.success("Cliente atualizado.");
      }
      setClients(ClientService.list());
      setEditing(null);
    } catch {
      toast.error("Não foi possível salvar o cliente.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Client) => {
    try {
      await ClientService.removeClient(c.id);
      setClients(ClientService.list());
      toast.success("Cliente removido.");
    } catch {
      toast.error("Não foi possível remover o cliente.");
    }
  };

  if (editing !== null) {
    return (
      <AppLayout title={editing === "new" ? "Novo cliente" : "Editar cliente"}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Foto do cliente">
            <ImageUploadField
              bucket="clients"
              value={form.photoUrl || undefined}
              onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
              label="Foto base"
              hint="Opcional · usada como ponto de partida no Provador"
              aspectClassName="aspect-[3/4]"
              fit="contain"
            />
          </Field>
          <Field label="Nome">
            <Input
              value={form.name}
              onChange={set("name")}
              required
              placeholder="Nome do cliente"
            />
          </Field>
          <Field label="Instagram">
            <Input
              value={form.instagram}
              onChange={set("instagram")}
              placeholder="@cliente"
            />
          </Field>
          <Field label="Telefone">
            <Input value={form.phone} onChange={set("phone")} placeholder="(11) 99999-0000" />
          </Field>
          <Field label="Observações">
            <Textarea
              value={form.notes}
              onChange={set("notes")}
              placeholder="Preferências, tamanho, histórico…"
            />
          </Field>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex-1 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-medium text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-full bg-clay px-6 py-3.5 text-sm font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
            >
              {busy ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </AppLayout>
    );
  }

  if (viewing) {
    return (
      <ClientFolder
        client={viewing}
        onBack={() => {
          setViewing(null);
          if (clientParam) void navigate({ search: {} });
        }}
      />
    );
  }

  return (
    <AppLayout title="Clientes" subtitle="Quem a loja atende">
      <div className="space-y-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome…"
              className="w-full rounded-full border border-input bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-clay"
            />
          </div>
          <button
            onClick={openNew}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-clay-foreground"
          >
            <Plus className="h-4 w-4" />
            Novo
          </button>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {query ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {filtered.map((c, i) => (
              <div
                key={c.id}
                className={
                  i > 0
                    ? "grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border-t border-border p-4"
                    : "grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-4"
                }
              >
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                    {c.name[0]}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setViewing(c)}
                  className="min-w-0 text-left"
                  aria-label={`Abrir pasta de ${c.name}`}
                >
                  <p className="truncate font-medium text-foreground">{c.name}</p>
                  {c.phone ? (
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" /> {c.phone}
                    </p>
                  ) : null}
                  {c.instagram ? (
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Instagram className="h-3 w-3 shrink-0" /> {c.instagram}
                    </p>
                  ) : null}
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-clay">
                    <BookImage className="h-3 w-3" /> Ver pasta
                  </span>
                </button>
                <div className="flex shrink-0 items-start gap-1">
                  <button
                    type="button"
                    aria-label={`Editar ${c.name}`}
                    onClick={() => openEdit(c)}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      aria-label={`Remover ${c.name}`}
                      onClick={() => remove(c)}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// Pasta do cliente: perfil + galeria "Looks gerados" buscada do banco
// (ClientService.listClientGenerations → generations filtradas por client_id,
// sob o RLS por loja). Reaproveita o grid/LookActions do álbum.
function ClientFolder({ client, onBack }: { client: Client; onBack: () => void }) {
  const [looks, setLooks] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    ClientService.listClientGenerations(client.id)
      .then((list) => active && setLooks(list))
      .catch(() => active && setLooks([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [client.id]);

  return (
    <AppLayout title={client.name} subtitle="Pasta do cliente">
      <div className="space-y-5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar aos clientes
        </button>

        {client.photoUrl ? (
          <img
            src={client.photoUrl}
            alt={client.name}
            className="mx-auto h-28 w-28 rounded-full object-cover"
          />
        ) : null}

        {client.phone || client.instagram || client.notes ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            {client.phone ? <p>{client.phone}</p> : null}
            {client.instagram ? <p>{client.instagram}</p> : null}
            {client.notes ? <p className="mt-1">{client.notes}</p> : null}
          </div>
        ) : null}

        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Looks gerados
        </p>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : looks.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma imagem gerada para este cliente ainda. Gere um look no Provador.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {looks.map((g) => (
              <article
                key={g.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-secondary">
                  <img
                    src={g.resultUrl}
                    alt="Look do cliente"
                    className="h-full w-full object-cover"
                  />
                  <LookActions
                    look={g}
                    actions={["favorite", "download", "share"]}
                    className="absolute right-2 top-2"
                  />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {new Date(g.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
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
