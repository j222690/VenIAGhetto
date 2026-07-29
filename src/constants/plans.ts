import type { Plan } from "@/types";

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceBRL: 97,
    tokens: 149,
    maxUsers: 3,
    librarySize: 50,
    historyDays: 90,
    features: [
      "Provador IA",
      "Scanner de peças",
      "Até 3 usuários",
      "Biblioteca até 50 itens",
      "Histórico de 90 dias",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceBRL: 197,
    tokens: 303,
    maxUsers: 10,
    librarySize: 300,
    historyDays: "unlimited",
    features: [
      "Tudo do Starter",
      "Criador de Posts",
      "Até 10 usuários",
      "Biblioteca até 300 itens",
      "Histórico ilimitado",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceBRL: 397,
    tokens: 610,
    maxUsers: 25,
    librarySize: "unlimited",
    historyDays: "unlimited",
    features: [
      "Tudo do Pro",
      "Até 25 usuários",
      "Biblioteca ilimitada",
      "Suporte prioritário",
    ],
  },
];

export const getPlan = (id: Plan["id"]): Plan => {
  const found = PLANS.find((p) => p.id === id);
  if (!found) throw new Error(`Plan not found: ${id}`);
  return found;
};
