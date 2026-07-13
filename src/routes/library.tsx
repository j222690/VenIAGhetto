import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import { Search, Trash2 } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import { AssetService } from "@/services/AssetService";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { AssetCategory } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Biblioteca — Vest IA" }] }),
  component: LibraryPage,
});

const TABS: { id: AssetCategory; label: string }[] = [
  { id: "model", label: "Modelos" },
  { id: "look", label: "Looks & Peças" },
  { id: "background", label: "Fundos" },
  { id: "generated", label: "Geradas" },
];

function LibraryPage() {
  const { session } = useAuth();
  const [tab, setTab] = useState<AssetCategory>("model");
  const [query, setQuery] = useState("");

  // Re-render quando o acervo muda (add/remove/load).
  useSyncExternalStore(
    (cb) => AssetService.subscribe(cb),
    () => AssetService.list().length,
    () => 0,
  );

  useEffect(() => {
    if (session) void AssetService.load(session.store.id);
  }, [session]);

  const items = useMemo(() => {
    const list = AssetService.list(tab);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((a) => a.name.toLowerCase().includes(q));
  }, [tab, query]);

  return (
    <AppLayout title="Biblioteca" subtitle="Seu acervo visual">
      <div className="space-y-5">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            className="w-full rounded-full border border-input bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-clay"
          />
        </div>

        {/* Upload real: envia a imagem e salva na categoria da aba atual. */}
        {session ? (
          <ImageUploadField
            bucket="catalog"
            label={`Enviar para "${TABS.find((t) => t.id === tab)?.label}"`}
            hint="Galeria ou câmera"
            aspectClassName="aspect-[16/9]"
            onChange={async (url) => {
              await AssetService.add({
                storeId: session.store.id,
                category: tab,
                name: "Enviado",
                url,
              });
              toast.success("Imagem adicionada à biblioteca.");
            }}
          />
        ) : null}

        <div className="-mx-5 overflow-x-auto px-5">
          <div className="flex gap-2 pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "border-clay bg-clay text-clay-foreground"
                    : "border-border bg-card text-foreground hover:border-clay/40",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nada por aqui ainda.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative">
                  <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remover"
                    onClick={async () => {
                      await AssetService.remove([a.id]);
                      toast.success("Removido da biblioteca.");
                    }}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/85 text-foreground shadow-soft backdrop-blur hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
