// Pacotes de tokens avulsos (compra única via Stripe). Os IDs precisam bater
// com o mapeamento de preços na Edge Function `stripe-checkout`
// (STRIPE_PRICE_TOKENS_100 / _300 / _1000) e a quantidade é creditada pelo
// webhook após o pagamento.

export interface TokenPack {
  id: string;
  tokens: number;
  priceBRL: number;
  label: string;
}

export const TOKEN_PACKS: TokenPack[] = [
  { id: "pack_100", tokens: 100, priceBRL: 49, label: "100 tokens" },
  { id: "pack_300", tokens: 300, priceBRL: 129, label: "300 tokens" },
  { id: "pack_1000", tokens: 1000, priceBRL: 429, label: "1.000 tokens" },
];
