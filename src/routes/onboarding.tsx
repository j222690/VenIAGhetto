import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shirt, ScanLine, Sparkles } from "@/lib/icons";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Bem-vindo — Vest IA" }] }),
  component: OnboardingPage,
});

const STEPS = [
  {
    icon: Shirt,
    title: "Provador IA",
    desc: "Suba a foto do modelo e da peça — a IA monta o look pronto para postar.",
  },
  {
    icon: ScanLine,
    title: "Scanner de peças",
    desc: "Fotografe uma peça e receba a ficha completa: cor, tecido, preço sugerido e SEO.",
  },
  {
    icon: Sparkles,
    title: "Posts em segundos",
    desc: "Imagem tratada + 3 versões de copy (Instagram, WhatsApp e Facebook).",
  },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const item = STEPS[step];
  const Icon = item.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-14">
      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={
              i <= step ? "h-1 flex-1 rounded-full bg-clay" : "h-1 flex-1 rounded-full bg-secondary"
            }
          />
        ))}
      </div>

      <div className="mt-16 grid h-20 w-20 place-items-center rounded-3xl bg-clay/10 text-clay">
        <Icon className="h-8 w-8" />
      </div>
      <h1 className="mt-8 font-display text-3xl font-semibold text-foreground">
        {item.title}
      </h1>
      <p className="mt-3 text-base text-muted-foreground">{item.desc}</p>

      <div className="mt-auto grid gap-3">
        <button
          onClick={() => (last ? navigate({ to: "/home" }) : setStep(step + 1))}
          className="w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft"
        >
          {last ? "Entrar no app" : "Próximo"}
        </button>
        {!last ? (
          <button
            onClick={() => navigate({ to: "/home" })}
            className="text-sm text-muted-foreground"
          >
            Pular tour
          </button>
        ) : null}
      </div>
    </div>
  );
}
