import { Link } from "@tanstack/react-router";
import { Home, Shirt, Users, BookImage, Settings as SettingsIcon } from "@/lib/icons";

// 5 destinos fixos (sem aperto no mobile). Provador é a ferramenta principal;
// Clientes e Álbum ganham acesso direto aqui. Scanner e Posts continuam na Home
// (FeatureCards "Crie com IA") e Catálogo/Histórico nos atalhos da Home — nada
// some da navegação, só foi reorganizado.
const ITEMS = [
  { to: "/home", label: "Início", icon: Home },
  { to: "/tryon", label: "Provador", icon: Shirt },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/album", label: "Álbum", icon: BookImage },
  { to: "/settings", label: "Ajustes", icon: SettingsIcon },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {ITEMS.map(({ to, label, icon: Icon }) => (
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
