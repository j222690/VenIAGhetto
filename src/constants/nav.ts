import { Home, Shirt, Users, BookImage, Settings as SettingsIcon } from "@/lib/icons";

// Destinos fixos de navegação — compartilhados entre BottomNav (mobile) e
// Sidebar (desktop), pra não duplicar a lista em dois lugares. O Provador é a
// ação principal: fica no CENTRO da barra do celular, em destaque (`primary`),
// sempre a um toque. Scanner e Criar corpo ficam na Home; Catálogo e
// Histórico nos atalhos da Home. (O Criador de Posts saiu do app.)
export const NAV_ITEMS = [
  { to: "/home", label: "Início", icon: Home, primary: false },
  { to: "/clients", label: "Clientes", icon: Users, primary: false },
  { to: "/tryon", label: "Provar", icon: Shirt, primary: true },
  { to: "/album", label: "Álbum", icon: BookImage, primary: false },
  { to: "/settings", label: "Ajustes", icon: SettingsIcon, primary: false },
] as const;
