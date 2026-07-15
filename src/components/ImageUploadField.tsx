import { useRef, useState } from "react";
import { ImagePlus } from "@/lib/icons";
import { StorageService, type StorageBucket } from "@/services/StorageService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  bucket: StorageBucket;
  value?: string;
  onChange: (url: string) => void;
  label: string;
  hint?: string;
  /** Tailwind aspect ratio class. Default 3/4 (retrato). */
  aspectClassName?: string;
  /**
   * "cover" (padrão) preenche a caixa cortando o excesso — bom para
   * miniaturas de produto. "contain" mostra a foto INTEIRA sem cortar (com
   * barras se sobrar espaço) — use para fotos de pessoa (cliente/modelo),
   * onde conferir a foto completa antes de gerar (e gastar tokens) importa.
   */
  fit?: "cover" | "contain";
}

// Seletor de imagem que sobe o arquivo real pro Supabase Storage (via
// StorageService) e devolve a URL. `accept="image/*"` sem `capture` deixa o
// dispositivo oferecer GALERIA e CÂMERA (no iOS/Android aparecem as duas
// opções) — forçar `capture` restringiria só à câmera. Toda a regra de upload
// (validação, caminho por loja, isolamento) vive no StorageService.
export function ImageUploadField({
  bucket,
  value,
  onChange,
  label,
  hint,
  aspectClassName = "aspect-[3/4]",
  fit = "cover",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => {
    if (!uploading) inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permite reescolher o mesmo arquivo depois (limpa o valor do input).
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const { url } = await StorageService.uploadImage(file, bucket);
      onChange(url);
      toast.success("Imagem enviada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={pick}
        disabled={uploading}
        className={cn(
          "group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border bg-secondary/60 text-center transition-colors hover:border-clay/60 hover:bg-secondary disabled:cursor-wait",
          aspectClassName,
        )}
      >
        {value ? (
          <img
            src={value}
            alt={label}
            className={cn(
              "absolute inset-0 h-full w-full",
              fit === "contain" ? "object-contain" : "object-cover",
            )}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-background">
              <ImagePlus className="h-5 w-5 text-clay" />
            </div>
            <p className="font-medium text-foreground">{label}</p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        )}

        {uploading ? (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-clay border-t-transparent" />
              <span className="text-xs font-medium text-foreground">Enviando…</span>
            </div>
          </div>
        ) : value ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-foreground shadow-soft backdrop-blur">
            Trocar foto
          </span>
        ) : null}
      </button>

      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
    </>
  );
}
