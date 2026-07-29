import { Home, Shirt, Users, BookImage, Settings as SettingsIcon } from "@/lib/icons";

// Destinos fixos de navegação — compartilhados entre BottomNav (mobile) e
// Sidebar (desktop), pra não duplicar a lista em dois lugares. Provador é a
// ferramenta principal; Clientes e Álbum ganham acesso direto aqui. Scanner e
// Posts continuam na Home (FeatureCards "Crie com IA") e Catálogo/Histórico
// nos atalhos da Home — nada some da navegação, só foi reorganizado.
export const NAV_ITEMS = [
  { to: "/home", label: "Início", icon: Home },
  { to: "/tryon", label: "Provador", icon: Shirt },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/album", label: "Álbum", icon: BookImage },
  { to: "/settings", label: "Ajustes", icon: SettingsIcon },
] as const;
