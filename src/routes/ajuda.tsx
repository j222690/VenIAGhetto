// /ajuda — a tela de ajuda, com as perguntas frequentes e a conversa.
//
// Existe ao lado da bolha (AssistantBubble), não no lugar dela: a bolha atende
// a dúvida do momento, no meio de uma tarefa; esta tela atende quem quer
// entender o app antes de começar, e é onde o suporte humano fica visível.

import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/layouts/AppLayout";
import { AssistantChat } from "@/components/AssistantChat";
import { SUPPORT_PHONE_LABEL, SUPPORT_WHATSAPP } from "@/constants/contact";
import { ArrowUpRight, MessageCircle } from "@/lib/icons";

export const Route = createFileRoute("/ajuda")({
  head: () => ({ meta: [{ title: "Ajuda — Vest Ai" }] }),
  component: AjudaPage,
});

function AjudaPage() {
  return (
    <AppLayout title="Ajuda" subtitle="Pergunte o que quiser sobre o app">
      <div className="flex min-h-[70vh] flex-col gap-4">
        <AssistantChat sugestoes={8} className="min-h-[55vh]" />

        <a
          href={SUPPORT_WHATSAPP}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center justify-between rounded-2xl border border-border bg-card p-4"
        >
          <span className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-clay" />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Falar com uma pessoa
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {SUPPORT_PHONE_LABEL}
              </span>
            </span>
          </span>
          <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </a>
      </div>
    </AppLayout>
  );
}
