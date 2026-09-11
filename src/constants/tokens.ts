// Pacotes de tokens avulsos (compra única via Mercado Pago). Os IDs precisam
// bater com a tabela PACOTES da Edge Function `mercadopago-checkout`, que é
// quem manda no preço e na quantidade — aqui é só o que a tela mostra. O
// crédito entra pelo webhook (ou na volta, no caso do cartão).

export interface TokenPack {
  id: string;
  tokens: number;
  priceBRL: number;
  label: string;
}

export const TOKEN_PACKS: TokenPack[] = [
  { id: "pack_100", tokens: 75, priceBRL: 49, label: "75 gerações" },
  { id: "pack_300", tokens: 198, priceBRL: 129, label: "198 gerações" },
  { id: "pack_1000", tokens: 660, priceBRL: 429, label: "660 gerações" },
];
