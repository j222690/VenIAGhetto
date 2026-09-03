// AssistantChat — a conversa com o assistente do app.
//
// Um componente só, usado nos dois lugares: na bolha que acompanha todas as
// telas e na tela de Ajuda. A diferença entre elas é o enquadramento, não o
// comportamento.

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "@/lib/icons";
import { AssistantService, type AssistantMessage } from "@/services/AssistantService";
import { PERGUNTAS_FREQUENTES } from "@/constants/assistantKnowledge";
import { SUPPORT_PHONE_LABEL, SUPPORT_WHATSAPP } from "@/constants/contact";
import { describeApiError } from "@/lib/apiErrors";
import { cn } from "@/lib/utils";

interface Props {
  /** Tela onde o lojista está — vira contexto da pergunta. */
  screen?: string;
  /** Quantas sugestões mostrar antes da primeira pergunta. */
  sugestoes?: number;
  className?: string;
}

export function AssistantChat({ screen, sugestoes = 4, className }: Props) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  // Rola para a última mensagem. `block: "nearest"` para não arrastar a página
  // inteira quando a conversa está dentro da tela de Ajuda.
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  const perguntar = async (pergunta: string) => {
    const limpa = pergunta.trim();
    if (!limpa || busy) return;
    const historico: AssistantMessage[] = [...messages, { role: "user", content: limpa }];
    setMessages(historico);
    setTexto("");
    setBusy(true);
    try {
      const resposta = await AssistantService.ask(historico, screen);
      setMessages([...historico, { role: "assistant", content: resposta }]);
    } catch (e) {
      setMessages([
        ...historico,
        {
          role: "assistant",
          content: describeApiError(e, "Não consegui responder agora. Tente de novo em instantes."),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pergunte qualquer coisa sobre o app — como usar uma tela, quanto custa, por que uma
              geração demorou. Não gasta crédito.
            </p>
            <div className="grid gap-2">
              {PERGUNTAS_FREQUENTES.slice(0, sugestoes).map((p) => (
                <button
                  key={p}
                  onClick={() => perguntar(p)}
                  className="rounded-2xl border border-border bg-card px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:border-clay/50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto bg-clay text-clay-foreground"
                : "border border-border bg-card text-foreground",
            )}
          >
            {m.content}
          </div>
        ))}

        {busy ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-clay border-t-transparent" />
            Escrevendo…
          </div>
        ) : null}

        {messages.length > 0 && !busy ? (
          <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
            Não resolveu?{" "}
            <a
              href={SUPPORT_WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-clay underline"
            >
              Fale com o suporte no {SUPPORT_PHONE_LABEL}
            </a>
            .
          </p>
        ) : null}
        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void perguntar(texto);
        }}
        className="flex shrink-0 items-end gap-2 pt-3"
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia; Shift+Enter quebra linha — é o que a pessoa espera
            // de um chat, e evita mandar pergunta pela metade.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void perguntar(texto);
            }
          }}
          rows={1}
          placeholder="Escreva sua dúvida…"
          className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-clay"
        />
        <button
          type="submit"
          disabled={!texto.trim() || busy}
          aria-label="Perguntar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-clay text-clay-foreground shadow-soft disabled:opacity-50"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
