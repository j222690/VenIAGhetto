import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ScanLine, Shirt } from "@/lib/icons";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Vest IA — Conteúdo de moda em segundos" },
      {
        name: "description",
        content:
          "Provador virtual, scanner de peças e criador de posts com IA para lojas e vendedores de moda.",
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-14">
        <p className="text-[11px] uppercase tracking-[0.25em] text-clay">
          Vest · IA
        </p>
        <h1 className="mt-4 font-display text-[2.5rem] leading-[1.05] font-semibold text-foreground">
          Conteúdo de moda profissional,
          <span className="text-clay"> em segundos.</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          IA para vendedores e lojas: provador virtual, scanner de peças e posts
          prontos para suas redes — com a estética da sua marca.
        </p>

        <div className="mt-10 grid gap-3">
          <FeatureRow icon={Shirt} title="Provador IA" desc="Veja a peça vestida em modelos." />
          <FeatureRow icon={ScanLine} title="Scanner de peças" desc="Ficha completa em um clique." />
          <FeatureRow icon={Sparkles} title="Posts prontos" desc="Imagem + copy para Insta, Whats e Face." />
        </div>

        <div className="mt-auto pt-10">
          <Link
            to="/register"
            className="block w-full rounded-full bg-clay px-6 py-4 text-center text-base font-semibold text-clay-foreground shadow-soft transition-transform active:scale-[0.99]"
          >
            Criar conta da loja
          </Link>
          <Link
            to="/login"
            className="mt-3 block w-full rounded-full border border-border bg-card px-6 py-4 text-center text-base font-semibold text-foreground"
          >
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Shirt;
  title: string;
  desc: string;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-clay">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
