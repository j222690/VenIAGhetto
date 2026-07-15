// LookActions — botões de Favoritar / Salvar / Compartilhar de um look.
// Reutilizado no Álbum (só favoritar) e na Home (as três ações).
// Toda a lógica passa pelos Services — o componente só dispara e mostra toast.

import { useState } from "react";
import { toast } from "sonner";
import { Download, Heart, Instagram, MessageCircle, Save, Share2, Trash2 } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Generation } from "@/types";
import { FavoritesService } from "@/services/FavoritesService";
import { GenerationService } from "@/services/GenerationService";
import { ShareService } from "@/services/ShareService";
import { AssetService } from "@/services/AssetService";
import { ClientService } from "@/services/ClientService";

export type LookAction =
  | "favorite"
  | "save"
  | "share"
  | "download"
  | "instagram"
  | "whatsapp"
  | "delete";

interface Props {
  look: Generation;
  actions?: LookAction[];
  /** Estilo dos botões: "overlay" (sobre a imagem) ou "bar" (barra abaixo). */
  variant?: "overlay" | "bar";
  className?: string;
  onFavoriteChange?: (favorite: boolean) => void;
  // Chamado após excluir com sucesso — quem usa tira o item da lista exibida
  // (o service já removeu do cache; isso só avisa a tela pra re-renderizar).
  onDeleted?: (id: string) => void;
}

export function LookActions({
  look,
  actions = ["favorite"],
  variant = "overlay",
  className,
  onFavoriteChange,
  onDeleted,
}: Props) {
  const [favorite, setFavorite] = useState(look.isFavorite);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const lookLabel = `Look · ${new Date(look.createdAt).toLocaleDateString("pt-BR")}`;

  const toggleFavorite = async () => {
    const next = await FavoritesService.toggleFavorite(look.id);
    setFavorite(next);
    onFavoriteChange?.(next);
    toast.success(next ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };

  const save = async () => {
    try {
      await AssetService.add({
        storeId: look.storeId,
        category: "generated",
        name: lookLabel,
        url: look.resultUrl,
      });
      toast.success("Look salvo na biblioteca");
    } catch {
      toast.error("Não foi possível salvar na biblioteca.");
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const result = await ShareService.share({
        title: "Vest IA",
        text: "Veja este look criado no Vest IA",
        url: look.resultUrl,
      });
      if (result === "copied") toast.success("Link copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível compartilhar.");
    } finally {
      setBusy(false);
    }
  };

  // Nome de arquivo amigável (cliente + data) reutilizado por baixar/compartilhar.
  const buildFilename = () => {
    const clientName = look.clientId ? ClientService.find(look.clientId)?.name : undefined;
    return ShareService.lookFilename(look.resultUrl, { createdAt: look.createdAt, clientName });
  };

  // Baixa a imagem para o aparelho. Toda a lógica de fetch/download no ShareService.
  const download = async () => {
    setDownloading(true);
    try {
      await ShareService.downloadImage(look.resultUrl, buildFilename());
      toast.success("Imagem salva no aparelho");
    } catch {
      toast.error("Não foi possível baixar a imagem.");
    } finally {
      setDownloading(false);
    }
  };

  // Exclui a FOTO gerada (não o cliente). Sem confirmação — mesma convenção
  // já usada em outras telas do app (excluir cliente/peça é direto também).
  const remove = async () => {
    setDeleting(true);
    try {
      await GenerationService.remove(look.id);
      toast.success("Foto excluída.");
      onDeleted?.(look.id);
    } catch {
      toast.error("Não foi possível excluir a foto.");
    } finally {
      setDeleting(false);
    }
  };

  const postInstagram = async () => {
    setBusy(true);
    try {
      const r = await ShareService.shareToInstagram(look.resultUrl, buildFilename());
      toast.success(
        r === "shared"
          ? "Escolha o Instagram para publicar."
          : "Imagem baixada e Instagram aberto — é só publicar.",
      );
    } finally {
      setBusy(false);
    }
  };

  const shareWhatsapp = async () => {
    setBusy(true);
    try {
      await ShareService.shareToWhatsApp(
        look.resultUrl,
        "Veja este look criado no Vest IA ✨",
        buildFilename(),
      );
    } finally {
      setBusy(false);
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

      {actions.includes("instagram") ? (
        <button
          type="button"
          aria-label="Postar no Instagram"
          disabled={busy}
          onClick={postInstagram}
          className={cn(btnBase, busy && "opacity-60")}
        >
          <Instagram className="h-4 w-4" />
          {!isOverlay ? <span>Instagram</span> : null}
        </button>
      ) : null}

      {actions.includes("whatsapp") ? (
        <button
          type="button"
          aria-label="Compartilhar no WhatsApp"
          disabled={busy}
          onClick={shareWhatsapp}
          className={cn(btnBase, busy && "opacity-60")}
        >
          <MessageCircle className="h-4 w-4" />
          {!isOverlay ? <span>WhatsApp</span> : null}
        </button>
      ) : null}

      {actions.includes("delete") ? (
        <button
          type="button"
          aria-label="Excluir foto"
          disabled={deleting}
          onClick={remove}
          className={cn(btnBase, deleting && "opacity-60", "hover:text-destructive")}
        >
          <Trash2 className="h-4 w-4" />
          {!isOverlay ? <span>{deleting ? "Excluindo…" : "Excluir"}</span> : null}
        </button>
      ) : null}
    </div>
  );
}
