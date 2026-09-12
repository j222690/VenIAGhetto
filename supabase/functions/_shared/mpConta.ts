// Acesso à conta Mercado Pago que RECEBE o dinheiro do Vest Ai.
//
// É uma só: a conta do dono do app, conectada por OAuth. Não é uma conta por
// loja — lojista nenhum conecta nada, ele só paga a assinatura.
//
// Existe para o dono do app não precisar criar conta de desenvolvedor e colar
// um access token. Ele clica em conectar, entra na conta que já tem, e as
// cobranças passam a sair em nome dela.
//
// Fica separado porque quem cobra não deveria se preocupar com validade de
// token: pede a conta, recebe um token que funciona.
//
// RENOVAR ANTES DE VENCER, NÃO DEPOIS. O token do OAuth dura 180 dias. Esperar
// ele expirar significa descobrir o problema no pior momento possível — uma
// cliente na tela de pagamento. A margem faz a renovação acontecer numa
// cobrança comum, semanas antes, e se falhar ainda sobra tempo para avisar a
// lojista.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Renova quando falta menos que isto para vencer. */
const MARGEM_MS = 7 * 24 * 60 * 60 * 1000;

export interface ContaMP {
  storeId: string;
  mpUserId: string;
  accessToken: string;
  liveMode: boolean;
}

interface Linha {
  store_id: string;
  mp_user_id: string;
  access_token: string;
  refresh_token: string;
  live_mode: boolean;
  expires_at: string;
}

async function renova(
  admin: SupabaseClient,
  linha: Linha,
  clientId: string,
  clientSecret: string,
): Promise<Linha> {
  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: linha.refresh_token,
    }),
  });
  const t = await res.json();
  if (!res.ok || !t.access_token) {
    // Devolve a linha como está: o token atual pode ainda funcionar dentro da
    // margem. Derrubar a cobrança aqui transformaria uma renovação falha em
    // venda perdida.
    console.error("[mpConta] renovação falhou:", JSON.stringify(t).slice(0, 200));
    return linha;
  }
  const atualizada: Linha = {
    ...linha,
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? linha.refresh_token,
    expires_at: new Date(Date.now() + Number(t.expires_in ?? 0) * 1000).toISOString(),
  };
  await admin
    .from("mp_accounts")
    .update({
      access_token: atualizada.access_token,
      refresh_token: atualizada.refresh_token,
      expires_at: atualizada.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("store_id", linha.store_id);
  return atualizada;
}

/**
 * A conta que recebe, com token válido. Devolve null quando o dono do app
 * ainda não conectou — situação normal enquanto a migração acontece, e por
 * isso quem chama cai no token fixo em vez de falhar.
 */
export async function contaDaPlataforma(
  admin: SupabaseClient,
  clientId: string,
  clientSecret: string,
): Promise<ContaMP | null> {
  // Uma linha só, sempre: quem conecta é o dono do app. Ordenar pela conexão
  // mais recente evita ficar com uma linha velha se alguma vez houver duas.
  const { data } = await admin
    .from("mp_accounts")
    .select("store_id, mp_user_id, access_token, refresh_token, live_mode, expires_at")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  let linha = data as Linha;
  if (new Date(linha.expires_at).getTime() - Date.now() < MARGEM_MS) {
    linha = await renova(admin, linha, clientId, clientSecret);
  }
  return {
    storeId: linha.store_id,
    mpUserId: linha.mp_user_id,
    accessToken: linha.access_token,
    liveMode: linha.live_mode,
  };
}
