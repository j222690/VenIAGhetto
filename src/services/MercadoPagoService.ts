// MercadoPagoService — a conta que RECEBE o dinheiro do Vest Ai.
//
// Só o dono do app usa isto. É a conta para onde vão as assinaturas e os
// pacotes que os lojistas pagam — antes ela era um access token colado num
// secret, e agora é uma conta conectada por OAuth.
//
// Não confundir com PaymentService, que é o lado de quem PAGA: a lojista
// assinando o plano. Lojista nenhum conecta conta aqui.
//
// O token nunca passa por aqui. O app só sabe se está conectada, o que vem de
// stores.mp_connected_at, e pede uma URL quando precisa.

import { supabase } from "@/integrations/supabase/client";

async function chama<T>(funcao: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(funcao, { body });
  if (error) {
    // A função devolve o motivo no corpo; sem isso a tela mostraria só
    // "Edge Function returned a non-2xx status code".
    let detalhe = "";
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      detalhe = (await ctx?.json?.())?.error ?? "";
    } catch {
      /* ignora */
    }
    throw new Error(detalhe || "Não foi possível falar com o Mercado Pago.");
  }
  const payload = data as T & { error?: string };
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

export const MercadoPagoService = {
  /** URL para onde mandar a lojista autorizar a conexão. */
  async urlDeConexao(): Promise<string> {
    const { url } = await chama<{ url: string }>("mercadopago-oauth", { action: "authorize" });
    return url;
  },

  async desconectar(): Promise<void> {
    await chama("mercadopago-oauth", { action: "disconnect" });
  },
};
