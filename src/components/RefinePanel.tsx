// RefinePanel — edição da imagem JÁ gerada: trocar o fundo/cenário e refinar.
//
// Usa a imagem atual como referência e pede ao Gemini uma nova versão editada
// (mantém pessoa e roupas). Tem um liga/desliga: quando ligado, mostra as
// opções; quando desligado, some. Devolve a nova URL via `onRefined`.

import { useState } from "react";
import { RotateCw, Sparkles } from "@/lib/icons";
import { AIService } from "@/services/AIService";
import { TokenService } from "@/services/TokenService";
import { GARMENT_FIDELITY_CLAUSE, IDENTITY_RECAP_CLAUSE, REALISM_CLAUSE } from "@/constants/prompts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Refinar gera uma nova imagem — custa tokens como as demais gerações.
const REFINE_COST = 4;

const BACKGROUNDS: { id: string; label: string; emoji: string; desc: string }[] = [
  { id: "estudio", label: "Estúdio", emoji: "📸", desc: "fundo de estúdio neutro e limpo, iluminação editorial" },
  { id: "praia", label: "Praia", emoji: "🏖️", desc: "uma praia ensolarada, mar e areia ao fundo" },
  { id: "urbano", label: "Urbano", emoji: "🏙️", desc: "uma rua urbana moderna ao fundo" },
  { id: "festa", label: "Festa", emoji: "🎉", desc: "um ambiente de festa noturna com luzes" },
  { id: "natureza", label: "Natureza", emoji: "🌳", desc: "um parque verde ao ar livre" },
  { id: "trabalho", label: "Trabalho", emoji: "💼", desc: "um escritório elegante" },
  { id: "casamento", label: "Evento", emoji: "🥂", desc: "um evento formal sofisticado" },
  { id: "cafe", label: "Café", emoji: "☕", desc: "um café aconchegante" },
];

interface Props {
  imageUrl: string;
  onRefined: (url: string) => void;
}

export function RefinePanel({ imageUrl, onRefined }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [background, setBackground] = useState<string>("");
  const [bgCustom, setBgCustom] = useState("");
  const [refine, setRefine] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    const bg = BACKGROUNDS.find((b) => b.id === background);
    if (!bg && !bgCustom.trim() && !refine.trim()) {
      toast.error("Escolha um fundo ou escreva um ajuste.");
      return;
    }
    if (!TokenService.hasBalance(REFINE_COST)) {
      toast.error("Saldo de tokens insuficiente para refinar.");
      return;
    }
    setBusy(true);
    try {
      const prompt =
        "Edite a imagem a seguir mantendo FIELMENTE a pessoa e as roupas (mesmo rosto, corpo e peças)." +
        (bg ? ` Troque o fundo/cenário para: ${bg.desc}.` : "") +
        (bgCustom.trim() ? ` Fundo: ${bgCustom.trim()}.` : "") +
        (refine.trim() ? ` Ajustes: ${refine.trim()}.` : "") +
        " Mantenha o mesmo enquadramento e proporção da imagem original. " +
        REALISM_CLAUSE +
        " " +
        GARMENT_FIDELITY_CLAUSE +
        " " +
        IDENTITY_RECAP_CLAUSE;
      const { url } = await AIService.image(prompt, { imageUrls: [imageUrl] });
      await TokenService.debit(REFINE_COST, "Refinar imagem");
      onRefined(url);
      toast.success("Imagem atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível refinar a imagem.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      {/* Liga/desliga */}
      <button
        onClick={() => setEnabled((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-clay" />
          <span className="text-sm font-medium text-foreground">Refinar / mudar fundo</span>
        </span>
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            enabled ? "bg-clay" : "bg-secondary",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
              enabled ? "left-[22px]" : "left-0.5",
            )}
          />
        </span>
      </button>

      {enabled ? (
        <div className="space-y-3 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            Edita a imagem gerada mantendo pessoa e roupas.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBackground((cur) => (cur === b.id ? "" : b.id))}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 transition",
                  background === b.id
                    ? "border-2 border-accent bg-card shadow-glow"
                    : "border-border bg-card hover:border-accent/50",
                )}
              >
                <span className="text-lg">{b.emoji}</span>
                <span className="text-[10px] font-medium text-foreground">{b.label}</span>
              </button>
            ))}
          </div>
          <input
            value={bgCustom}
            onChange={(e) => setBgCustom(e.target.value)}
            placeholder="Outro fundo (opcional)…"
            className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-clay"
          />
          <input
            value={refine}
            onChange={(e) => setRefine(e.target.value)}
            placeholder="Refinar: ex. melhorar a luz, tirar sombras…"
            className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-clay"
          />
          <button
            onClick={apply}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-clay px-6 py-3 text-sm font-semibold text-clay-foreground disabled:opacity-60"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-clay-foreground border-t-transparent" />
                Aplicando…
              </>
            ) : (
              <>
                <RotateCw className="h-4 w-4" /> Aplicar mudanças · {REFINE_COST} tokens
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
