import { createFileRoute } from "@tanstack/react-router";
import { thumbUrl } from "@/lib/imageUrl";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookImage,
  Check,
  Instagram,
  Pencil,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LookActions } from "@/components/LookActions";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { ClientService } from "@/services/ClientService";
import { AIService } from "@/services/AIService";
import { TokenService } from "@/services/TokenService";
import { describeApiError } from "@/lib/apiErrors";
import { usePermissions } from "@/hooks/usePermissions";
import type { Client, ClientPhoto, Generation } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/clients")({
  head: () => ({ meta: [{ title: "Clientes — Vest Ai" }] }),
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
            <Input value={form.instagram} onChange={set("instagram")} placeholder="@cliente" />
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
                    src={thumbUrl(c.photoUrl, { width: 96 })}
                    alt={c.name}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                    loading="lazy"
                    decoding="async"
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
function ClientFolder({ client: initialClient, onBack }: { client: Client; onBack: () => void }) {
  const [client, setClient] = useState(initialClient);
  const [looks, setLooks] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  // URL da foto que está gerando corpo inteiro (null = nenhuma).
  const [creatingBody, setCreatingBody] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    ClientService.listClientGenerations(client.id)
      .then((list) => active && setLooks(list))
      .catch(() => active && setLooks([]))
      .finally(() => active && setLoading(false));
    ClientService.listPhotos(client.id)
      .then((list) => active && setPhotos(list))
      .catch(() => {
        // migration 0021 pode não ter rodado ainda — segue sem a galeria.
      });
    return () => {
      active = false;
    };
  }, [client.id]);

  const addPhoto = async (url: string) => {
    try {
      const photo = await ClientService.addPhoto(client.id, url);
      setPhotos((prev) => [photo, ...prev]);
    } catch {
      toast.error("Não foi possível adicionar a foto.");
    }
  };

  const removePhoto = async (photo: ClientPhoto) => {
    try {
      await ClientService.removePhoto(photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch {
      toast.error("Não foi possível remover a foto.");
    }
  };

  const applyAsBasePhoto = async (url: string) => {
    try {
      const updated = await ClientService.setBasePhoto(client.id, url);
      setClient(updated);
      toast.success("Definida como foto-base do Provador.");
    } catch {
      toast.error("Não foi possível definir a foto-base.");
    }
  };

  // CRIAR CORPO — o Provador precisa da pessoa de corpo inteiro, e na prática
  // o lojista quase sempre tem foto cortada. Gera a mesma pessoa em corpo
  // inteiro e guarda na galeria (ver ClientService.createFullBodyPhoto).
  const createBody = async (sourceUrl: string) => {
    if (!TokenService.hasBalance(1)) {
      toast.error("Você já usou todas as gerações do mês. Adicione mais nas Configurações.");
      return;
    }
    setCreatingBody(sourceUrl);
    try {
      // Confere o enquadramento ANTES de cobrar o token (ver bodyFramingCheck).
      // Os dois desvios economizam uma geração que sairia ruim ou inútil.
      const check = await AIService.bodyFramingCheck(sourceUrl);
      if (check.status === "completa") {
        toast.info(check.mensagem, {
          duration: 8000,
          description: "Pode usar esta foto direto no Provador.",
        });
        return;
      }
      if (check.status === "curta") {
        toast.error(check.mensagem, {
          duration: 9000,
          description: "Use uma foto da cintura para cima — assim a IA completa só as pernas.",
        });
        return;
      }
      const photo = await ClientService.createFullBodyPhoto(client.id, sourceUrl);
      setPhotos((prev) => [photo, ...prev]);
      toast.success("Corpo inteiro gerado e salvo na galeria.", {
        duration: 8000,
        description: "A parte de baixo foi criada pela IA — confira antes de usar no Provador.",
      });
    } catch (e) {
      toast.error(describeApiError(e, "Não foi possível gerar o corpo inteiro."));
    } finally {
      setCreatingBody(null);
    }
  };

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

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fotos do cliente
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Toque numa foto pra usar como base do Provador, a com{" "}
              <Check className="inline h-3 w-3" /> é a atual.
            </p>
          </div>

          {/* CRIAR CORPO a partir da foto-BASE. O botão por foto (abaixo) só
              aparece na galeria, e o caso mais comum é justamente o cliente que
              tem só a foto-base e a galeria vazia — sem isto a função ficava
              inalcançável pra ele. O Provador precisa da pessoa de corpo
              inteiro; aqui o lojista completa uma foto cortada. */}
          {client.photoUrl ? (
            <button
              type="button"
              disabled={creatingBody !== null}
              onClick={() => createBody(client.photoUrl!)}
              className="flex w-full items-center justify-between rounded-2xl border border-dashed border-clay/40 bg-clay/5 px-4 py-3 text-left disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {creatingBody === client.photoUrl
                    ? "Gerando corpo inteiro…"
                    : "Criar corpo inteiro"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  A foto atual está cortada? A IA completa até os pés. 1 geração.
                </span>
              </span>
              <Sparkles className="h-5 w-5 shrink-0 text-clay" />
            </button>
          ) : null}
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => {
              const isBase = client.photoUrl === p.url;
              return (
                <div
                  key={p.id}
                  className="relative overflow-hidden rounded-2xl border border-border"
                >
                  <button
                    type="button"
                    onClick={() => applyAsBasePhoto(p.url)}
                    className="block aspect-square w-full"
                  >
                    <img
                      src={thumbUrl(p.url, { width: 200 })}
                      alt="Foto do cliente"
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                  {isBase ? (
                    <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-clay text-clay-foreground shadow-soft">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => removePhoto(p)}
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-background/85 text-foreground shadow-soft backdrop-blur"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Gerar corpo inteiro a partir desta foto"
                    disabled={creatingBody !== null}
                    onClick={() => createBody(p.url)}
                    className="absolute inset-x-1.5 bottom-1.5 rounded-full bg-background/85 px-2 py-1 text-[10px] font-medium text-foreground shadow-soft backdrop-blur disabled:opacity-60"
                  >
                    {creatingBody === p.url ? "Gerando…" : "Criar corpo"}
                  </button>
                </div>
              );
            })}
            <ImageUploadField
              bucket="clients"
              onChange={addPhoto}
              label="Adicionar"
              hint="Galeria/câmera"
              aspectClassName="aspect-square"
            />
          </div>
        </div>

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
                  <button
                    type="button"
                    onClick={() => setViewingUrl(g.resultUrl)}
                    aria-label="Ver foto completa"
                    className="block h-full w-full"
                  >
                    <img
                      src={thumbUrl(g.resultUrl, { width: 200 })}
                      alt="Look do cliente"
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                  <LookActions
                    look={g}
                    actions={["favorite", "download", "share", "delete"]}
                    onDeleted={(id) => setLooks((prev) => prev.filter((l) => l.id !== id))}
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
      <PhotoLightbox url={viewingUrl} onClose={() => setViewingUrl(null)} />
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
