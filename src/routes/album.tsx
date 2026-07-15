import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, Heart } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { LookActions } from "@/components/LookActions";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { GenerationService } from "@/services/GenerationService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/album")({
  head: () => ({ meta: [{ title: "Álbum de Looks — Vest IA" }] }),
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
  // Cópia local (não só leitura direta do service) para excluir refletir na
  // hora sem precisar navegar pra fora e voltar.
  const [all, setAll] = useState(GenerationService.history());
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);

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
                  <button
                    type="button"
                    onClick={() => setViewingUrl(look.resultUrl)}
                    aria-label="Ver foto completa"
                    className="block h-full w-full"
                  >
                    <img
                      src={look.resultUrl}
                      alt={TYPE_LABEL[look.type] ?? "Look"}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <LookActions
                    look={look}
                    actions={["favorite", "download", "delete"]}
                    onDeleted={(id) => setAll((prev) => prev.filter((g) => g.id !== id))}
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
                  {look.copies ? (
                    <>
                      <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[11px] leading-snug text-muted-foreground">
                        {look.copies.instagram}
                      </p>
                      <button
                        onClick={() => {
                          const c = look.copies!;
                          const full = [c.instagram, c.hashtags.join(" ")].filter(Boolean).join("\n\n");
                          navigator.clipboard.writeText(full);
                          toast.success("Legenda copiada.");
                        }}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-clay"
                      >
                        <Copy className="h-3 w-3" /> Copiar legenda
                      </button>
                    </>
                  ) : null}
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
