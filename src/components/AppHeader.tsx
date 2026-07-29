import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { TokenBadge } from "./TokenBadge";

interface Props {
  title?: string;
  subtitle?: string;
  showTokens?: boolean;
}

export function AppHeader({ title, subtitle, showTokens = true }: Props) {
  const { session } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 lg:max-w-3xl">
        <div className="min-w-0">
          {title ? (
            <h1 className="truncate font-display text-xl font-semibold text-foreground">{title}</h1>
          ) : (
            // No desktop a Sidebar já mostra marca/loja — aqui vira só um link
            // pra Home, sem duplicar o texto.
            <Link to="/home" className="block min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground lg:hidden">
                Vest Ai
              </p>
              <p className="truncate font-display text-lg font-semibold text-foreground">
                {session?.store.name ?? "Vest Ai"}
              </p>
            </Link>
          )}
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {/* No desktop o saldo já fica fixo no rodapé da Sidebar — evita repetir aqui. */}
        {showTokens ? (
          <div className="lg:hidden">
            <TokenBadge />
          </div>
        ) : null}
      </div>
    </header>
  );
}
