import { Link } from "@tanstack/react-router";
import { NAV_ITEMS } from "@/constants/nav";

// Só no mobile/tablet — a partir de lg a Sidebar assume a navegação.
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeProps={{ className: "text-clay" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors hover:text-foreground"
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
