import { Sparkles } from "@/lib/icons";

export function LoadingOverlay({ label = "Gerando com IA…" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-md">
      <div className="flex flex-col items-center gap-5 px-8 text-center">
        <div className="relative grid h-16 w-16 place-items-center rounded-full bg-clay/10">
          <span className="absolute inset-0 animate-ping rounded-full bg-clay/20" />
          <Sparkles className="h-7 w-7 text-clay" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Polindo cada detalhe — leva alguns segundos.
          </p>
        </div>
      </div>
    </div>
  );
}
