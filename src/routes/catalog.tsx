import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import { usePermissions } from "@/hooks/usePermissions";
import { CatalogService } from "@/services/CatalogService";
import type { CatalogItem } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/catalog")({
  head: () => ({ meta: [{ title: "Catálogo — StyleDesk" }] }),
  component: CatalogPage,
});

// Categorias sugeridas para o filtro/formulário.
const CATEGORIES = ["Vestidos", "Conjuntos", "Camisas", "Calças", "Saias", "Casacos", "Acessórios"];

interface ItemForm {
  name: string;
  category: string;
  price: string;
  imageUrl: string;
  description: string;
  sku: string;
  active: boolean;
}

const EMPTY_FORM: ItemForm = {
  name: "",
  category: "",
  price: "",
  imageUrl: "",
  description: "",
  sku: "",
  active: true,
};

function CatalogPage() {
  const { can } = usePermissions();
  const canManage = can("catalog:manage");

  const [items, setItems] = useState<CatalogItem[]>(CatalogService.list());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    CatalogService.load()
      .then((list) => active && setItems(list))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

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
      description: it.description ?? "",
      sku: it.sku ?? "",
      active: it.active,
    });
    setEditing(it);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const input = {
        name: form.name,
        category: form.category || null,
        price: form.price ? Number(form.price) : null,
        imageUrl: form.imageUrl || null,
        description: form.description || null,
        sku: form.sku || null,
        active: form.active,
      };
      if (editing === "new") {
        await CatalogService.add(input);
        toast.success("Peça adicionada ao catálogo.");
      } else if (editing) {
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

  if (editing !== null) {
    return (
      <AppLayout title={editing === "new" ? "Nova peça" : "Editar peça"}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Foto da peça">
            <ImageUploadField
              bucket="catalog"
              label="Enviar foto da peça"
              hint="Galeria ou câmera"
              value={form.imageUrl || undefined}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
            />
          </Field>
          <Field label="Nome">
            <Input
              value={form.name}
              onChange={set(setForm, "name")}
              required
              placeholder="Vestido midi linho"
            />
          </Field>
          <Field label="Categoria">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-clay"
            >
              <option value="">Sem categoria</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
              onChange={set(setForm, "imageUrl")}
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
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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
            <button
              onClick={openNew}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-clay-foreground"
            >
              <Plus className="h-4 w-4" />
              Nova
            </button>
          ) : null}
        </div>

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
