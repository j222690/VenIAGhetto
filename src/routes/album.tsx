import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Heart } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { LookActions } from "@/components/LookActions";
import { GenerationService } from "@/services/GenerationService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/album")({
  head: () => ({ meta: [{ title: "Álbum de Looks — StyleDesk" }] }),
  component: AlbumPage,
});

const TYPE_LABEL: Record<string, string> = {
  tryon: "Provador",
  post: "Post",
  scanner: "Scanner",
};

function AlbumPage() {
  // Hoje os looks vêm do seed (via GenerationService). Quando a geração real
  // existir, GenerationService passa a ler da tabela `generations` e esta tela
  // não muda — segue consumindo history()/favorites().
  const all = GenerationService.history();
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // `onlyFavorites` recalcula a partir do estado atual do service ao alternar.
  const looks = useMemo(
    () => (onlyFavorites ? all.filter((g) => g.isFavorite) : all),
    [all, onlyFavorites],
  );

  return (
    <AppLayout title="Álbum de Looks" subtitle="Tudo que você criou">
      <div className="space-y-5">
        <div className="flex gap-2">
          <FilterChip active={!onlyFavorites} onClick={() => setOnlyFavorites(false)}>
            Todos
          </FilterChip>
          <FilterChip active={onlyFavorites} onClick={() => setOnlyFavorites(true)}>
            <Heart className={cn("h-3.5 w-3.5", onlyFavorites && "fill-current")} />
            Favoritos
          </FilterChip>
        </div>

        {looks.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {onlyFavorites
              ? "Nenhum look favoritado ainda."
              : "Nada por aqui ainda — gere seu primeiro look."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {looks.map((look) => (
              <article
                key={look.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-secondary">
                  <img
                    src={look.resultUrl}
                    alt={TYPE_LABEL[look.type] ?? "Look"}
                    className="h-full w-full object-cover"
                  />
                  <LookActions
                    look={look}
                    actions={["favorite", "download"]}
                    className="absolute right-2 top-2"
                  />
                </div>
                <div className="p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {TYPE_LABEL[look.type] ?? "Look"}
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">
                    {new Date(look.createdAt).toLocaleDateString("pt-BR")}
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

function FilterChip({
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
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-clay bg-clay text-clay-foreground"
          : "border-border bg-card text-foreground hover:border-clay/40",
      )}
    >
      {children}
    </button>
  );
}
