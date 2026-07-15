import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RotateCw, Trash2 } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { GenerationService } from "@/services/GenerationService";
import { ClientService } from "@/services/ClientService";
import { CatalogService } from "@/services/CatalogService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Generation, GenerationType } from "@/types";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Histórico — Vest IA" }] }),
  component: HistoryPage,
});

const FILTERS: { id: GenerationType | "all"; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "tryon", label: "Provador" },
  { id: "post", label: "Posts" },
  { id: "scanner", label: "Scanner" },
];

const ROUTE: Record<GenerationType, "/tryon" | "/posts" | "/scanner"> = {
  tryon: "/tryon",
  post: "/posts",
  scanner: "/scanner",
};

const LABEL: Record<GenerationType, string> = {
  tryon: "Provador",
  post: "Post",
  scanner: "Scanner",
};

function HistoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<GenerationType | "all">("all");
  // Cópia local (não só leitura direta do service) para excluir refletir na
  // tela na hora.
  const [all, setAll] = useState<Generation[]>(GenerationService.history());
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  // Carrega clientes e catálogo para resolver nomes nos detalhes da geração.
  const [, setReady] = useState(0);

  useEffect(() => {
    Promise.all([ClientService.load().catch(() => {}), CatalogService.load().catch(() => {})]).then(
      () => setReady((n) => n + 1),
    );
  }, []);

  const items = useMemo(
    () => (filter === "all" ? all : all.filter((g) => g.type === filter)),
    [all, filter],
  );

  const removeItem = async (id: string) => {
    try {
      await GenerationService.remove(id);
      setAll((prev) => prev.filter((g) => g.id !== id));
      toast.success("Foto excluída.");
    } catch {
      toast.error("Não foi possível excluir a foto.");
    }
  };

  return (
    <AppLayout title="Histórico">
      <div className="space-y-5">
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium",
                filter === f.id
                  ? "border-clay bg-clay text-clay-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {items.map((g) => {
            const clientName = g.clientId ? ClientService.find(g.clientId)?.name : undefined;
            const itemName = g.inputs.catalogItemId
              ? CatalogService.find(g.inputs.catalogItemId)?.name
              : undefined;
            const detail = [clientName && `Cliente: ${clientName}`, itemName && `Peça: ${itemName}`]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={g.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <button
                  type="button"
                  onClick={() => setViewingUrl(g.resultUrl)}
                  aria-label="Ver foto completa"
                  className="shrink-0"
                >
                  <img
                    src={g.resultUrl}
                    alt={g.type}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                </button>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {LABEL[g.type]} · {g.tokensCost} tokens
                  </p>
                  <p className="truncate font-medium text-foreground">
                    {new Date(g.createdAt).toLocaleString("pt-BR")}
                  </p>
                  {detail ? (
                    <p className="truncate text-xs text-muted-foreground">{detail}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => navigate({ to: ROUTE[g.type] })}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-medium"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Regenerar
                  </button>
                  <button
                    type="button"
                    aria-label="Excluir foto"
                    onClick={() => removeItem(g.id)}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Sem gerações neste filtro.
            </p>
          ) : null}
        </div>
      </div>
      <PhotoLightbox url={viewingUrl} onClose={() => setViewingUrl(null)} />
    </AppLayout>
  );
}
