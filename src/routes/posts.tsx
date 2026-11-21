import { createFileRoute, redirect } from "@tanstack/react-router";

// O Criador de Posts saiu do app (pouco usado). A rota continua existindo só
// pra quem tinha o link salvo cair no Início em vez de numa página de erro.
// Dados antigos (gerações do tipo "post") seguem no Supabase e no Álbum.
export const Route = createFileRoute("/posts")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
