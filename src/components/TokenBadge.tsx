import { Sparkles } from "@/lib/icons";
import { useTokens } from "@/hooks/useTokens";
import { cn } from "@/lib/utils";

export function TokenBadge() {
  const { balance, lowBalance } = useTokens();
  return (
    <div
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        lowBalance
          ? "border-clay/40 bg-clay/10 text-clay"
          : "border-border bg-secondary text-secondary-foreground",
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {balance} tokens
    </div>
  );
}
