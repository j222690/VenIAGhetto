// AssistantBubble — a bolha de ajuda que acompanha todas as telas.
//
// Fica no AppLayout porque a dúvida aparece NA HORA de usar: "e agora, o que
// eu faço aqui?" no meio do Provador. Uma tela de ajuda separada só é achada
// por quem já parou o que estava fazendo — por isso existem as duas.
//
// A bolha sabe em que tela o lojista está e manda isso junto com a pergunta.

import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, X } from "@/lib/icons";
import { AssistantChat } from "@/components/AssistantChat";

// Rota → nome que a lojista vê. O assistente recebe este nome, não o caminho:
// "/tryon" não diz nada a quem responde em português.
const NOME_DA_TELA: Record<string, string> = {
  "/home": "Início",
  "/tryon": "Provador",
  "/clients": "Clientes",
  "/catalog": "Catálogo",
  "/album": "Álbum de Looks",
  "/posts": "Criador de Posts",
  "/scanner": "Scanner de peças",
  "/history": "Histórico",
  "/settings": "Ajustes",
  "/profile": "Perfil da loja",
  "/plans": "Planos",
  "/library": "Biblioteca",
};

export function AssistantBubble() {
  const [aberto, setAberto] = useState(false);
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const tela = NOME_DA_TELA[caminho];

  // Esc fecha, como qualquer painel sobreposto.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  // Na própria tela de Ajuda a bolha seria redundante.
  if (caminho === "/ajuda") return null;

  return (
    <>
      {!aberto ? (
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir ajuda"
          // bottom acima da barra de navegação no celular; no desktop ela some.
          className="fixed bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] right-4 z-40 grid h-13 w-13 place-items-center rounded-full bg-clay p-3.5 text-clay-foreground shadow-elevated transition-transform hover:scale-105 lg:bottom-6"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : null}

      {aberto ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center">
          <button
            aria-label="Fechar ajuda"
            onClick={() => setAberto(false)}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <div className="relative flex h-[85vh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-background p-5 shadow-elevated sm:h-[70vh] sm:rounded-3xl">
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold text-foreground">Ajuda</p>
                <p className="text-xs text-muted-foreground">
                  {tela ? `Você está em ${tela}` : "Tire dúvidas sobre o app"}
                </p>
              </div>
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AssistantChat screen={tela} sugestoes={3} />
          </div>
        </div>
      ) : null}
    </>
  );
}
