// BackgroundRefPicker — quando uma categoria de cenário tem mais de uma foto
// de referência (ver BACKGROUNDS em lookOptions.ts), mostra miniaturas pro
// lojista escolher qual usar. Com só 1 opção, não renderiza nada.

import type { BackgroundRef } from "@/constants/lookOptions";
import { Check } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface Props {
  refs: BackgroundRef[];
  value: string;
  onChange: (url: string) => void;
}

export function BackgroundRefPicker({ refs, value, onChange }: Props) {
  if (refs.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {refs.map((r) => {
        const active = r.url === value;
        return (
          <button
            key={r.url}
            onClick={() => onChange(r.url)}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <span
              className={cn(
                "relative h-16 w-16 overflow-hidden rounded-xl border-2",
                active ? "border-accent shadow-glow" : "border-border",
              )}
            >
              <img src={r.url} alt={r.label} className="h-full w-full object-cover" />
              {active ? (
                <span className="absolute inset-0 flex items-center justify-center bg-foreground/20">
                  <Check className="h-5 w-5 text-white" />
                </span>
              ) : null}
            </span>
            <span className="text-[10px] font-medium text-foreground">{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}
