import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Globe, ImagePlus, Pencil, Plus, Search, Sparkles, Trash2, Wand2 } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { CatalogService, categoriesForSegment } from "@/services/CatalogService";
import { TokenService } from "@/services/TokenService";
import { useTokens } from "@/hooks/useTokens";
import type { CatalogItem } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Custo em tokens por item importado (foto ou link). O link tem um mínimo para
// cobrir a leitura da página mesmo em importações pequenas.
const IMPORT_TOKEN_PER_ITEM = 1;
const IMPORT_URL_MIN_TOKENS = 5;
// "Limpar peça" (opcional) — isola a peça da foto (remove fundo/modelo).
// Flat 1 token (token = R$0,65); custo real ~R$0,35 → margem ~46% (mesma conta do Refinar).
const CLEAN_IMAGE_COST = 1;

export const Route = createFileRoute("/catalog")({
  head: () => ({ meta: [{ title: "Catálogo — Vest IA" }] }),
  component: CatalogPage,
});

interface ItemForm {
  name: string;
  category: string;
  price: string;
  imageUrl: string;
  cleanImageUrl: string;
  description: string;
  sku: string;
  active: boolean;
}

const EMPTY_FORM: ItemForm = {
  name: "",
  category: "",
  price: "",
  imageUrl: "",
  cleanImageUrl: "",
  description: "",
  sku: "",
  active: true,
};

function CatalogPage() {
  const { session } = useAuth();
  const { balance } = useTokens();
  const { can } = usePermissions();
  const canManage = can("catalog:manage");

  // Categorias visíveis conforme o Direcionamento da loja (Configurações) —
  // uma loja "masculina" não mostra Vestidos/Saias, por exemplo.
  const CATEGORIES = categoriesForSegment(session?.store.segment ?? "feminina");

  const [items, setItems] = useState<CatalogItem[]>(CatalogService.list());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const [editing, setEditing] = useState<CatalogItem | "new" | "import" | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [cleaningImage, setCleaningImage] = useState(false);
  // categoriesForSegment lê um cache mutável (customCategories); esse contador
  // só existe pra forçar o React a re-renderizar quando ele muda.
  const [, setCatVersion] = useState(0);
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Importação por foto (IA) e por link.
  const [importPhotos, setImportPhotos] = useState<string[]>([]);
  const [importUrl, setImportUrl] = useState("");
  const [importLabel, setImportLabel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    CatalogService.load()
      .then((list) => active && setItems(list))
      .finally(() => active && setLoading(false));
    CatalogService.loadCategories()
      .then(() => active && setCatVersion((n) => n + 1))
      .catch(() => {
        // migration 0020 pode não ter rodado ainda — segue só com a lista fixa.
      });
    return () => {
      active = false;
    };
  }, []);

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await CatalogService.addCategory(name);
      setCatVersion((n) => n + 1);
      setForm((f) => ({ ...f, category: name }));
      setNewCategoryMode(false);
      setNewCategoryName("");
      toast.success("Categoria criada.");
    } catch {
      toast.error("Não foi possível criar a categoria.");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const matchesQuery =
        !q || it.name.toLowerCase().includes(q) || (it.sku?.toLowerCase().includes(q) ?? false);
      const matchesCat = category === "all" || it.category === category;
      return matchesQuery && matchesCat;
    });
  }, [items, query, category]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing("new");
  };

  const openEdit = (it: CatalogItem) => {
    setForm({
      name: it.name,
      category: it.category ?? "",
      price: it.price != null ? String(it.price) : "",
      imageUrl: it.imageUrl ?? "",
      cleanImageUrl: it.cleanImageUrl ?? "",
      description: it.description ?? "",
      sku: it.sku ?? "",
      active: it.active,
    });
    setEditing(it);
  };

  // "Limpar peça" (opcional, cobra token): gera uma versão isolada da foto —
  // remove fundo e, se houver, a pessoa/modelo que estiver vestindo a peça na
  // referência. Só roda quando o lojista pede (nunca automático).
  const cleanPiece = async () => {
    if (!form.imageUrl) return;
    if (!TokenService.hasBalance(CLEAN_IMAGE_COST)) {
      toast.error("Você já usou todas as gerações do mês. Adicione mais nas Configurações.");
      return;
    }
    setCleaningImage(true);
    try {
      const cleanUrl = await CatalogService.cleanPieceImage(form.imageUrl);
      setForm((f) => ({ ...f, cleanImageUrl: cleanUrl }));
      await TokenService.debit(CLEAN_IMAGE_COST, "Limpeza de peça (catálogo)");
      toast.success("Peça limpa — isso melhora o resultado no Provador.");
    } catch {
      toast.error("Não foi possível limpar a peça.");
    } finally {
      setCleaningImage(false);
    }
  };

  const openImport = () => {
    setImportPhotos([]);
    setImportUrl("");
    setEditing("import");
  };

  // Importa o catálogo a partir de um link (e-commerce/Instagram). Cobra tokens
  // por item importado.
  const runImportUrl = async () => {
    const url = importUrl.trim();
    if (!url) {
      toast.error("Cole o link da loja.");
      return;
    }
    setBusy(true);
    setImportLabel("Acessando o link e lendo o catálogo…");
    try {
      const products = await CatalogService.importFromUrl(url);
      if (products.length === 0) {
        toast.error("Nenhum produto encontrado nesse link.");
        return;
      }
      // 1 token por item, com um mínimo para cobrir a leitura da página.
      const cost = Math.max(IMPORT_URL_MIN_TOKENS, products.length * IMPORT_TOKEN_PER_ITEM);
      if (!TokenService.hasBalance(cost)) {
        toast.error(`São necessários ${cost} tokens para importar ${products.length} itens.`);
        return;
      }
      let done = 0;
      for (const p of products) {
        setImportLabel(`Importando… ${done + 1}/${products.length}`);
        await CatalogService.add({
          name: p.name,
          category: p.category || null,
          price: p.price,
          imageUrl: p.imageUrl || null,
          active: true,
        });
        done++;
      }
      await TokenService.debit(cost, `Importação de catálogo (${done} itens)`);
      setItems([...CatalogService.list()]);
      toast.success(`${done} produto(s) importado(s) do link.`);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar do link.");
    } finally {
      setBusy(false);
      setImportLabel(null);
    }
  };

  // Importa vários produtos de uma vez: para cada foto, a IA extrai nome,
  // categoria e preço e cria a peça já com a imagem.
  const runImport = async () => {
    if (importPhotos.length === 0) {
      toast.error("Adicione ao menos uma foto de produto.");
      return;
    }
    const cost = importPhotos.length * IMPORT_TOKEN_PER_ITEM;
    if (!TokenService.hasBalance(cost)) {
      toast.error(`São necessários ${cost} tokens para importar ${importPhotos.length} fotos.`);
      return;
    }
    setBusy(true);
    try {
      let done = 0;
      for (const url of importPhotos) {
        setImportLabel(`Lendo produtos… ${done + 1}/${importPhotos.length}`);
        const draft = await CatalogService.draftFromImage(url);
        await CatalogService.add({
          name: draft.name,
          category: draft.category || null,
          price: draft.price,
          imageUrl: url,
          active: true,
        });
        done++;
      }
      await TokenService.debit(cost, `Importação por foto (${done} itens)`);
      setItems([...CatalogService.list()]);
      toast.success(`${done} peça(s) importada(s) para o catálogo.`);
      setEditing(null);
    } catch {
      toast.error("Não foi possível importar. Tente novamente.");
    } finally {
      setBusy(false);
      setImportLabel(null);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    // Obrigatórios para criar/editar uma peça: nome, foto e categoria.
    if (!form.name.trim()) {
      toast.error("Informe o nome da peça.");
      return;
    }
    if (!form.imageUrl.trim()) {
      toast.error("Adicione a foto da peça.");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Escolha a categoria.");
      return;
    }
    setBusy(true);
    try {
      const input = {
        name: form.name,
        category: form.category || null,
        price: form.price ? Number(form.price) : null,
        imageUrl: form.imageUrl || null,
        cleanImageUrl: form.cleanImageUrl || null,
        description: form.description || null,
        sku: form.sku || null,
        active: form.active,
      };
      if (editing === "new") {
        await CatalogService.add(input);
        toast.success("Peça adicionada ao catálogo.");
      } else if (editing && editing !== "import") {
        await CatalogService.update(editing.id, input);
        toast.success("Peça atualizada.");
      }
      setItems([...CatalogService.list()]);
      setEditing(null);
    } catch {
      toast.error("Não foi possível salvar a peça.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (it: CatalogItem) => {
    try {
      await CatalogService.remove(it.id);
      setItems([...CatalogService.list()]);
      toast.success("Peça removida.");
    } catch {
      toast.error("Não foi possível remover a peça.");
    }
  };

  if (editing === "import") {
    return (
      <AppLayout title="Importar catálogo">
        <div className="space-y-5">
          {/* Importar por LINK (e-commerce / Instagram) */}
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Globe className="h-4 w-4 text-clay" /> Importar por link
            </p>
            <p className="text-xs text-muted-foreground">
              Cole o link da sua loja (e-commerce). A IA acessa a página e extrai os produtos
              automaticamente. Consome {IMPORT_TOKEN_PER_ITEM} token por item (mínimo{" "}
              {IMPORT_URL_MIN_TOKENS}).
            </p>
            <input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://sualoja.com.br/produtos"
              className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-clay"
            />
            <button
              type="button"
              onClick={runImportUrl}
              disabled={busy || !importUrl.trim()}
              className="w-full rounded-full bg-clay px-6 py-3 text-sm font-semibold text-clay-foreground disabled:opacity-60"
            >
              Importar do link
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">ou por foto</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-clay" /> Importe por foto — a IA cataloga
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Envie as fotos dos seus produtos (prints do WhatsApp ou qualquer formato). A IA
              identifica o nome, a categoria e um preço sugerido de cada peça. Consome{" "}
              {IMPORT_TOKEN_PER_ITEM} token por foto. Você revisa depois.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {importPhotos.map((url, i) => (
              <div key={url} className="relative overflow-hidden rounded-2xl border border-border">
                <img src={url} alt={`Produto ${i + 1}`} className="aspect-square w-full object-cover" />
                <button
                  onClick={() => setImportPhotos((p) => p.filter((_, idx) => idx !== i))}
                  aria-label="Remover foto"
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/85 text-foreground shadow-soft backdrop-blur"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <ImageUploadField
              bucket="catalog"
              onChange={(url) => setImportPhotos((p) => [...p, url])}
              label={importPhotos.length ? "Adicionar" : "Adicionar fotos"}
              hint="1 ou várias"
              aspectClassName="aspect-square"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex-1 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-medium text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={busy || importPhotos.length === 0}
              className="flex-1 rounded-full bg-clay px-6 py-3.5 text-sm font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
            >
              {busy ? "Importando…" : `Importar ${importPhotos.length || ""} peça(s)`}
            </button>
          </div>
        </div>
        {busy ? <LoadingOverlay label={importLabel ?? "Importando…"} /> : null}
      </AppLayout>
    );
  }

  if (editing !== null) {
    return (
      <AppLayout title={editing === "new" ? "Nova peça" : "Editar peça"}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Foto da peça *">
            <ImageUploadField
              bucket="catalog"
              label="Enviar foto da peça"
              hint="Galeria ou câmera"
              value={form.imageUrl || undefined}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url, cleanImageUrl: "" }))}
            />
            {form.imageUrl ? (
              form.cleanImageUrl ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-clay">
                  <Check className="h-3.5 w-3.5" /> Peça limpa — melhora o resultado no Provador
                </p>
              ) : (
                <button
                  type="button"
                  onClick={cleanPiece}
                  disabled={cleaningImage}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-clay disabled:opacity-60"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {cleaningImage
                    ? "Limpando…"
                    : `Limpar peça? (melhora a geração) · ${Math.floor(balance / CLEAN_IMAGE_COST)} gerações restantes`}
                </button>
              )
            ) : null}
          </Field>
          <Field label="Nome *">
            <Input
              value={form.name}
              onChange={set(setForm, "name")}
              required
              placeholder="Vestido midi linho"
            />
          </Field>
          <Field label="Categoria *">
            {newCategoryMode ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da nova categoria"
                />
                <button
                  type="button"
                  onClick={createCategory}
                  disabled={!newCategoryName.trim()}
                  className="shrink-0 rounded-xl bg-clay px-4 py-3 text-sm font-semibold text-clay-foreground disabled:opacity-60"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryMode(false);
                    setNewCategoryName("");
                  }}
                  className="shrink-0 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <select
                value={form.category}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setNewCategoryMode(true);
                    return;
                  }
                  setForm((f) => ({ ...f, category: e.target.value }));
                }}
                className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
              >
                <option value="">Selecione a categoria…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__new__">+ Criar nova categoria…</option>
              </select>
            )}
          </Field>
          <Field label="Preço (R$)">
            <Input
              type="number"
              inputMode="decimal"
              value={form.price}
              onChange={set(setForm, "price")}
              placeholder="389"
            />
          </Field>
          <Field label="ou cole uma URL de imagem">
            {/* Alternativa ao upload: colar uma URL externa direto. */}
            <Input
              value={form.imageUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, imageUrl: e.target.value, cleanImageUrl: "" }))
              }
              placeholder="https://…"
            />
          </Field>
          <Field label="SKU">
            <Input value={form.sku} onChange={set(setForm, "sku")} placeholder="VST-001" />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={form.description}
              onChange={set(setForm, "description")}
              placeholder="Tecido, caimento, ocasião…"
            />
          </Field>
          <label className="flex items-center justify-between rounded-xl border border-input bg-card px-4 py-3">
            <span className="text-sm font-medium text-foreground">Ativa (aparece no Provador)</span>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-5 w-5 accent-clay"
            />
          </label>

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

  return (
    <AppLayout title="Catálogo" subtitle="As peças que a loja vende">
      <div className="space-y-5">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar peça ou SKU…"
            className="w-full rounded-full border border-input bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-clay"
          />
        </div>
        {canManage ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={openImport}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-clay bg-card px-4 py-2.5 text-sm font-medium text-clay"
            >
              <ImagePlus className="h-4 w-4" />
              Importar
            </button>
            <button
              onClick={openNew}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-clay-foreground"
            >
              <Plus className="h-4 w-4" />
              Nova peça
            </button>
          </div>
        ) : null}

        <div className="-mx-5 overflow-x-auto px-5">
          <div className="flex gap-2 pb-1">
            <Chip active={category === "all"} onClick={() => setCategory("all")}>
              Todas
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {query || category !== "all"
              ? "Nenhuma peça encontrada."
              : "Catálogo vazio — adicione sua primeira peça."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((it) => (
              <article
                key={it.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-secondary">
                  {it.imageUrl ? (
                    <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                  ) : null}
                  {!it.active ? (
                    <span className="absolute left-2 top-2 rounded-full bg-foreground/70 px-2 py-0.5 text-[10px] font-medium text-background">
                      Inativa
                    </span>
                  ) : null}
                  {canManage ? (
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        type="button"
                        aria-label={`Editar ${it.name}`}
                        onClick={() => openEdit(it)}
                        className="grid h-8 w-8 place-items-center rounded-full bg-background/85 text-foreground shadow-soft backdrop-blur"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remover ${it.name}`}
                        onClick={() => remove(it)}
                        className="grid h-8 w-8 place-items-center rounded-full bg-background/85 text-foreground shadow-soft backdrop-blur hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-foreground">{it.name}</p>
                  <div className="mt-0.5 flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">{it.category ?? "—"}</p>
                    {it.price != null ? (
                      <p className="shrink-0 text-sm font-semibold text-clay">
                        R$ {it.price.toLocaleString("pt-BR")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-clay bg-clay text-clay-foreground"
          : "border-border bg-card text-foreground hover:border-clay/40",
      )}
    >
      {children}
    </button>
  );
}

function set<T>(setter: React.Dispatch<React.SetStateAction<T>>, key: keyof T) {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setter((f) => ({ ...f, [key]: e.target.value }));
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
