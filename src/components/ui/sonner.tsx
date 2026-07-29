import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Notificações no estilo do app (cartão escuro, borda de cor por tipo, glow
// sutil) em vez do visual genérico padrão do Sonner. Aparecem no TOPO — no
// mobile, embaixo elas tampavam botão de ação/nav (pedido explícito do usuário).
// O offset usa env(safe-area-inset-top) (viewport-fit=cover já setado em
// __root.tsx) — sem isso, um offset fixo em px ficava por baixo do
// notch/câmera em celulares com entalhe/furo na tela.
//
// IMPORTANTE: classes aqui são aplicadas DIRETO em cada elemento pelo próprio
// Sonner (via toastOptions.classNames) — não precisam do prefixo `group-[...]:`
// (que exigiria um ancestral com as duas classes ".group.toaster" batendo
// exatamente, e não estava gerando o CSS certo aqui — o toast saía com o
// visual genérico branco do Sonner mesmo com as classes "certas" no elemento).
const SAFE_TOP_OFFSET = "calc(env(safe-area-inset-top) + 12px)";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster"
      position="top-center"
      offset={SAFE_TOP_OFFSET}
      mobileOffset={SAFE_TOP_OFFSET}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-start gap-3 rounded-[28px] border-2 border-border bg-card text-card-foreground " +
            "shadow-lg px-4 py-3.5",
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
          actionButton: "bg-clay text-clay-foreground rounded-full px-3 py-1.5 text-xs font-semibold",
          cancelButton: "bg-muted text-muted-foreground rounded-full px-3 py-1.5 text-xs font-semibold",
          icon: "shrink-0",
          error: "border-destructive shadow-[0_0_20px_-4px_var(--destructive)]",
          success: "border-clay shadow-glow",
          warning: "border-accent-2 shadow-glow",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
