// AssistantService — o assistente que explica o app para a lojista.
//
// Manda a conversa e a base de conhecimento para a Edge Function `assistente`,
// que responde com texto. Não gera imagem e NÃO gasta crédito.

import { supabase } from "@/integrations/supabase/client";
import { APP_KNOWLEDGE } from "@/constants/assistantKnowledge";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

/** Últimas trocas enviadas como contexto. Ajuda não precisa de mais memória. */
const JANELA = 12;

// O prompt já pede texto puro, mas o modelo escorrega de volta para markdown
// de vez em quando — e a tela mostra o texto como veio, então "**Provador**"
// apareceria com os asteriscos. Tirar aqui é mais barato que renderizar
// markdown por causa de um negrito ocasional.
function limparMarcacao(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(?!\s)(.+?)(?<!\s)\*(?=\s|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

export const AssistantService = {
  async ask(messages: AssistantMessage[], screen?: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke("assistente", {
      body: {
        messages: messages.slice(-JANELA),
        knowledge: APP_KNOWLEDGE,
        screen,
      },
    });
    if (error) {
      // A função devolve o motivo no corpo; sem isso a tela mostraria só
      // "Edge Function returned a non-2xx status code", que não ajuda ninguém.
      let detalhe = "";
      try {
        const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
        detalhe = (await ctx?.json?.())?.error ?? "";
      } catch {
        /* ignora */
      }
      throw new Error(detalhe || "O assistente não respondeu. Tente de novo.");
    }
    const payload = data as { text?: string; error?: string };
    if (payload?.error) throw new Error(payload.error);
    const texto = payload?.text?.trim();
    if (!texto) throw new Error("O assistente não respondeu. Tente de novo.");
    return limparMarcacao(texto);
  },
};
