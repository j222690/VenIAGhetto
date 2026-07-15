// PhotoLightbox — mostra a foto INTEIRA em tela cheia (object-contain, sem
// cortar). Usado no Álbum/Histórico/pasta do cliente: clicar numa miniatura
// (sempre recortada em grade) abre a foto completa aqui.

import { X } from "@/lib/icons";

interface Props {
  url: string | null;
  onClose: () => void;
}

export function PhotoLightbox({ url, onClose }: Props) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={url}
        alt="Foto ampliada"
        className="max-h-full max-w-full rounded-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-background/85 text-foreground shadow-soft backdrop-blur"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
