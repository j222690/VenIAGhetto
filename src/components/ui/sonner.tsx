import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Notificações no estilo do app (cartão escuro, borda de cor por tipo, glow
// sutil) em vez do visual genérico padrão do Sonner. Aparecem no TOPO — no
// mobile, embaixo elas tampavam botão de ação/nav (pedido explícito do usuário).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-3xl group-[.toaster]:border-2 group-[.toaster]:bg-card " +
            "group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg " +
            "group-[.toaster]:px-4 group-[.toaster]:py-3",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-clay group-[.toast]:text-clay-foreground group-[.toast]:rounded-full",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-full",
          error: "group-[.toaster]:border-destructive group-[.toaster]:shadow-[0_0_20px_-4px_var(--destructive)]",
          success: "group-[.toaster]:border-clay group-[.toaster]:shadow-glow",
          warning: "group-[.toaster]:border-accent-2 group-[.toaster]:shadow-glow",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
