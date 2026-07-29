import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { NAV_ITEMS } from "@/constants/nav";
import { TokenBadge } from "./TokenBadge";

// Navegação de DESKTOP (lg+) — menu lateral fixo, substitui a BottomNav
// (que só existe até lg). Abaixo de lg nem é renderizada (hidden por padrão).
export function Sidebar() {
  const { session } = useAuth();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-background lg:flex">
      <Link to="/home" className="block border-b border-border/60 px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Vest Ai</p>
        <p className="truncate font-display text-lg font-semibold text-foreground">
          {session?.store.name ?? "Vest Ai"}
        </p>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeProps={{ className: "bg-secondary text-foreground" }}
            inactiveProps={{
              className: "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-border/60 p-4">
        <TokenBadge />
      </div>
    </aside>
  );
}
