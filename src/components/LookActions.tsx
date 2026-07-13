// LookActions — botões de Favoritar / Salvar / Compartilhar de um look.
// Reutilizado no Álbum (só favoritar) e na Home (as três ações).
// Toda a lógica passa pelos Services — o componente só dispara e mostra toast.

import { useState } from "react";
import { toast } from "sonner";
import { Download, Heart, Save, Share2 } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Generation } from "@/types";
import { FavoritesService } from "@/services/FavoritesService";
import { ShareService } from "@/services/ShareService";
import { AssetService } from "@/services/AssetService";
import { ClientService } from "@/services/ClientService";

export type LookAction = "favorite" | "save" | "share" | "download";

interface Props {
  look: Generation;
  actions?: LookAction[];
  /** Estilo dos botões: "overlay" (sobre a imagem) ou "bar" (barra abaixo). */
  variant?: "overlay" | "bar";
  className?: string;
  onFavoriteChange?: (favorite: boolean) => void;
}

export function LookActions({
  look,
  actions = ["favorite"],
  variant = "overlay",
  className,
  onFavoriteChange,
}: Props) {
  const [favorite, setFavorite] = useState(look.isFavorite);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const lookLabel = `Look · ${new Date(look.createdAt).toLocaleDateString("pt-BR")}`;

  const toggleFavorite = async () => {
    const next = await FavoritesService.toggleFavorite(look.id);
    setFavorite(next);
    onFavoriteChange?.(next);
    toast.success(next ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };

  const save = () => {
    AssetService.add({
      storeId: look.storeId,
      category: "generated",
      name: lookLabel,
      url: look.resultUrl,
    });
    toast.success("Look salvo na biblioteca");
  };

  const share = async () => {
    setBusy(true);
    try {
      const result = await ShareService.share({
        title: "StyleDesk AI",
        text: "Veja este look criado no StyleDesk AI",
        url: look.resultUrl,
      });
      if (result === "copied") toast.success("Link copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível compartilhar.");
    } finally {
      setBusy(false);
    }
  };

  // Baixa a imagem para o aparelho. Nome amigável com cliente (se houver) e
  // data; toda a lógica de fetch/download mora no ShareService.
  const download = async () => {
    setDownloading(true);
    try {
      const clientName = look.clientId ? ClientService.find(look.clientId)?.name : undefined;
      const filename = ShareService.lookFilename(look.resultUrl, {
        createdAt: look.createdAt,
        clientName,
      });
      await ShareService.downloadImage(look.resultUrl, filename);
      toast.success("Imagem salva no aparelho");
    } catch {
      toast.error("Não foi possível baixar a imagem.");
    } finally {
      setDownloading(false);
    }
  };

  const isOverlay = variant === "overlay";
  const btnBase = isOverlay
    ? "grid h-9 w-9 place-items-center rounded-full bg-background/85 text-foreground shadow-soft backdrop-blur transition-colors hover:bg-background"
    : "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-clay/40";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {actions.includes("favorite") ? (
        <button
          type="button"
          aria-label={favorite ? "Desfavoritar" : "Favoritar"}
          aria-pressed={favorite}
          onClick={toggleFavorite}
          className={btnBase}
        >
          <Heart className={cn("h-4 w-4", favorite ? "fill-clay text-clay" : "text-foreground")} />
          {!isOverlay ? <span>Favoritar</span> : null}
        </button>
      ) : null}

      {actions.includes("save") ? (
        <button type="button" aria-label="Salvar na biblioteca" onClick={save} className={btnBase}>
          <Save className="h-4 w-4" />
          {!isOverlay ? <span>Salvar</span> : null}
        </button>
      ) : null}

      {actions.includes("download") ? (
        <button
          type="button"
          aria-label="Baixar imagem"
          disabled={downloading}
          onClick={download}
          className={cn(btnBase, downloading && "opacity-60")}
        >
          {downloading && isOverlay ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-clay border-t-transparent" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {!isOverlay ? <span>{downloading ? "Baixando…" : "Baixar"}</span> : null}
        </button>
      ) : null}

      {actions.includes("share") ? (
        <button
          type="button"
          aria-label="Compartilhar"
          disabled={busy}
          onClick={share}
          className={cn(btnBase, busy && "opacity-60")}
        >
          <Share2 className="h-4 w-4" />
          {!isOverlay ? <span>Compartilhar</span> : null}
        </button>
      ) : null}
    </div>
  );
}
