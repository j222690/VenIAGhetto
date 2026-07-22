// RefinePanel — edição da imagem JÁ gerada: trocar o fundo/cenário e refinar.
//
// Usa a imagem atual como referência e pede ao Gemini uma nova versão editada
// (mantém pessoa e roupas). Tem um liga/desliga: quando ligado, mostra as
// opções; quando desligado, some. Devolve a nova URL via `onRefined`.

import { useState } from "react";
import { RotateCw, Sparkles } from "@/lib/icons";
import { AIService } from "@/services/AIService";
import { TokenService } from "@/services/TokenService";
import { useTokens } from "@/hooks/useTokens";
import {
  buildBackgroundClause,
  COLOR_LIGHT_INDEPENDENCE_CLAUSE,
  GARMENT_FIDELITY_CLAUSE,
  POSE_LOCK_CLAUSE,
  REALISM_CLAUSE,
  REF_APP_ANATOMY_CLAUSE,
  REF_APP_FIDELITY_CLOSING_CLAUSE,
} from "@/constants/prompts";
import { BACKGROUNDS } from "@/constants/lookOptions";
import { describeApiError } from "@/lib/apiErrors";
import { BackgroundRefPicker } from "@/components/BackgroundRefPicker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Refinar gera uma nova imagem — custa tokens como as demais gerações.
// Flat 1 token (token = R$0,65); custo real ~R$0,35 → margem ~46% (ver GenerationService.ts).
const REFINE_COST = 1;

interface Props {
  imageUrl: string;
  onRefined: (url: string) => void;
}

export function RefinePanel({ imageUrl, onRefined }: Props) {
  const { balance } = useTokens();
  const [enabled, setEnabled] = useState(false);
  const [background, setBackground] = useState<string>("");
  const [bgRefUrl, setBgRefUrl] = useState<string>("");
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
      toast.error("Você já usou todas as gerações do mês para refinar.");
      return;
    }
    setBusy(true);
    try {
      const changingScene = !!bg || !!bgCustom.trim();
      const prompt =
        "Isto é uma EDIÇÃO de uma foto real, não a criação de uma pessoa nova — mantenha EXATAMENTE o " +
        "mesmo rosto, tom de pele, cabelo, corpo e proporções da imagem original, como um editor de " +
        "fotos ajustando só o fundo/detalhes. " +
        REF_APP_ANATOMY_CLAUSE +
        (bg ? buildBackgroundClause(bg.desc, true) : "") +
        (bgCustom.trim() ? ` Fundo: ${bgCustom.trim()}.` : "") +
        (refine.trim() ? ` Ajustes: ${refine.trim()}.` : "") +
        " Mantenha o mesmo enquadramento e proporção da imagem original. " +
        (changingScene ? POSE_LOCK_CLAUSE + " " + COLOR_LIGHT_INDEPENDENCE_CLAUSE + " " : "") +
        REALISM_CLAUSE +
        " " +
        GARMENT_FIDELITY_CLAUSE +
        " " +
        REF_APP_FIDELITY_CLOSING_CLAUSE;
      const { url, balance } = await AIService.image(prompt, "refine", {
        imageUrls: bg && bgRefUrl ? [imageUrl, bgRefUrl] : [imageUrl],
      });
      TokenService.syncAfterServerDebit(REFINE_COST, "Refinar imagem", balance);
      onRefined(url);
      toast.success("Imagem atualizada.");
    } catch (e) {
      toast.error(describeApiError(e, "Não foi possível refinar a imagem."));
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
          <div className="grid grid-cols-3 gap-2">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  const deselecting = background === b.id;
                  setBackground(deselecting ? "" : b.id);
                  setBgRefUrl(deselecting ? "" : b.refs[0]?.url ?? "");
                }}
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
          <BackgroundRefPicker
            refs={BACKGROUNDS.find((b) => b.id === background)?.refs ?? []}
            value={bgRefUrl}
            onChange={setBgRefUrl}
          />
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
                <RotateCw className="h-4 w-4" /> Aplicar mudanças · {Math.floor(balance / REFINE_COST)} gerações restantes
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
