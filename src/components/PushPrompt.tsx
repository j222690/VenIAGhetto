// Convite para ligar as notificações, na tela inicial.
//
// Por que ele existe aqui: a geração agora roda em segundo plano, então o
// lojista pode disparar e ir atender outra pessoa. Sem notificação, ele
// precisa voltar no app e ficar conferindo — que é exatamente o que a
// geração assíncrona tentou eliminar.
//
// O card SOME sozinho quando não há nada a pedir: navegador sem suporte, ou
// permissão já concedida. Um aviso permanente que não pode ser resolvido é
// só ruído na tela principal.

import { useState } from "react";
import { Bell, Share2, X } from "@/lib/icons";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const DISPENSADO = "vestai:push-dispensado";

export function PushPrompt() {
  const { session } = useAuth();
  const push = usePushNotifications(session?.user.id);
  const [dispensado, setDispensado] = useState(() => {
    try {
      return localStorage.getItem(DISPENSADO) === "1";
    } catch {
      return false;
    }
  });

  // Nada a pedir: sem suporte, já autorizado, ou o lojista fechou o card.
  if (!push.suportado || push.permissao === "granted" || dispensado) return null;

  const fechar = () => {
    setDispensado(true);
    try {
      localStorage.setItem(DISPENSADO, "1");
    } catch {
      /* modo privado: some só nesta sessão */
    }
  };

  // iPhone sem o app instalado: a Apple não oferece Web Push numa aba do
  // Safari, só no app adicionado à tela de início. Aqui o botão não
  // resolveria nada — o certo é ensinar a instalar.
  const precisaInstalar = push.isIOS && !push.isStandalone;

  // Já negou antes: o navegador não pergunta de novo, então botão não
  // adianta. Tem que ser revertido na mão, nas permissões do site.
  const negado = push.permissao === "denied";

  const ativar = async () => {
    const ok = await push.ativar();
    if (ok) {
      toast.success("Notificações ligadas.", {
        description: "Avisamos quando sua imagem ficar pronta, mesmo com o app fechado.",
      });
    } else {
      toast.error("Não foi possível ligar as notificações.", {
        description: "Verifique se o navegador não bloqueou os avisos deste site.",
      });
    }
  };

  return (
    <section className="relative rounded-3xl border border-clay/40 bg-clay/5 p-5">
      <button
        type="button"
        aria-label="Dispensar"
        onClick={fechar}
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-clay text-clay-foreground shadow-soft">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Quer ser avisado quando a imagem ficar pronta?
          </p>

          {precisaInstalar ? (
            <>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                No iPhone, os avisos só funcionam com o Vest Ai instalado na tela de início. Toque
                em <Share2 className="inline h-3.5 w-3.5 align-text-bottom" /> Compartilhar e depois
                em <strong className="text-foreground">Adicionar à Tela de Início</strong>. Abra o
                app por lá e este aviso reaparece pra você ligar.
              </p>
            </>
          ) : negado ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Os avisos estão bloqueados para este site. Toque no cadeado ao lado do endereço,
              procure <strong className="text-foreground">Notificações</strong> e mude para Permitir
              — depois recarregue a página.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                A geração roda em segundo plano: você pode fechar o app e continuar atendendo. A
                gente avisa quando terminar.
              </p>
              <button
                type="button"
                onClick={ativar}
                disabled={push.ativando}
                className="mt-3 rounded-full bg-clay px-5 py-2.5 text-sm font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
              >
                {push.ativando ? "Ligando…" : "Ligar notificações"}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
