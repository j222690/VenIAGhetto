import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Search, Upload } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { AssetService } from "@/services/AssetService";
import { cn } from "@/lib/utils";
import type { AssetCategory } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Biblioteca — StyleDesk" }] }),
  component: LibraryPage,
});

const TABS: { id: AssetCategory; label: string }[] = [
  { id: "model", label: "Modelos" },
  { id: "look", label: "Looks & Peças" },
  { id: "background", label: "Fundos" },
  { id: "generated", label: "Geradas" },
];

function LibraryPage() {
  const [tab, setTab] = useState<AssetCategory>("model");
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const list = AssetService.list(tab);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((a) => a.name.toLowerCase().includes(q));
  }, [tab, query]);

  return (
    <AppLayout title="Biblioteca" subtitle="Seu acervo visual">
      <div className="space-y-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-full border border-input bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-clay"
            />
          </div>
          <button
            onClick={() => toast.success("Upload em breve.")}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-clay-foreground"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </div>

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
                <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" />
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
