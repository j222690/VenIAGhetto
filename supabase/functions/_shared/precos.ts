// Preços e cotas, do lado do servidor.
//
// Vive aqui, e não em cada função, porque as duas precisam da mesma verdade e
// por motivos diferentes: o checkout usa para COBRAR, o webhook usa para
// CREDITAR. Enquanto estavam duplicados, mudar o preço do Pro num arquivo e
// esquecer o outro cobraria um valor e entregaria a cota de outro — e nada no
// build acusaria.
//
// Continua separado de src/constants/plans.ts de propósito: função Edge não
// importa código do cliente, e quem decide quanto cobrar é o servidor. Ao
// mexer num preço, mexa nos dois — o do cliente é só o que a tela mostra.

export interface Oferta {
  titulo: string;
  preco: number;
  tokens: number;
}

export const PLANOS: Record<string, Oferta> = {
  starter: { titulo: "Vest Ai — Starter", preco: 97, tokens: 149 },
  pro: { titulo: "Vest Ai — Pro", preco: 197, tokens: 303 },
  business: { titulo: "Vest Ai — Business", preco: 397, tokens: 610 },
};

export const PACOTES: Record<string, Oferta> = {
  pack_100: { titulo: "Vest Ai — 75 gerações", preco: 49, tokens: 75 },
  pack_300: { titulo: "Vest Ai — 198 gerações", preco: 129, tokens: 198 },
  pack_1000: { titulo: "Vest Ai — 660 gerações", preco: 429, tokens: 660 },
};

/**
 * A referência externa é o único campo que volta em TUDO — pagamento avulso,
 * assinatura e cobrança mensal. Por isso carrega o que o webhook precisa
 * saber, em vez de depender de metadata (que a assinatura não transporta).
 */
export const refDe = (storeId: string, kind: string, id: string) => `${storeId}|${kind}|${id}`;

export function leRef(ref: unknown): { storeId: string; kind: string; id: string } {
  const [storeId = "", kind = "", id = ""] = String(ref ?? "").split("|");
  return { storeId, kind, id };
}
