// Canais de contato da Vest Ai.
//
// Ficam num arquivo só porque aparecem em lugares distantes — página de
// vendas, Ajustes do app — e um número desatualizado num deles é um cliente
// falando sozinho.

/** Suporte a quem JÁ usa o app. Formato internacional, só dígitos. */
export const SUPPORT_PHONE = "5549991796245";

/** Como o número é lido por uma pessoa: (49) 99179-6245. */
export const SUPPORT_PHONE_LABEL = "(49) 99179-6245";

/** Vendas — quem ainda não é cliente e quer conhecer o produto. */
export const SALES_PHONE = "5549989033938";

// Link do WhatsApp com a mensagem já escrita: o lojista não precisa explicar
// de onde veio, e quem atende já sabe o contexto.
export const waLink = (phone: string, mensagem: string): string =>
  `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;

export const SUPPORT_WHATSAPP = waLink(SUPPORT_PHONE, "Olá! Preciso de ajuda com o Vest Ai.");
