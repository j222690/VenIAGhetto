import { Link } from "@tanstack/react-router";
import { NAV_ITEMS } from "@/constants/nav";

// Só no mobile/tablet — a partir de lg a Sidebar assume a navegação.
// Barra translúcida com o Provador no centro, num botão dourado elevado: é a
// ação que o lojista faz no balcão, então não pode competir com as outras.
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/80 backdrop-blur-2xl backdrop-saturate-150 lg:hidden">
      <div className="mx-auto flex max-w-md items-end justify-between px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, primary }) =>
          primary ? (
            <Link
              key={to}
              to={to}
              aria-label={label}
              search={{ g: undefined }}
              className="group -mt-6 flex flex-1 flex-col items-center gap-1 text-[11px] font-semibold"
              activeProps={{ className: "text-clay" }}
              inactiveProps={{ className: "text-foreground" }}
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-clay text-clay-foreground shadow-elevated ring-4 ring-background transition-transform group-active:scale-95">
                <Icon className="h-6 w-6" />
              </span>
              <span>{label}</span>
            </Link>
          ) : (
            <Link
              key={to}
              to={to}
              activeProps={{ className: "text-clay" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex min-h-12 flex-1 flex-col items-center justify-end gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors hover:text-foreground"
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.6} />
              <span>{label}</span>
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
