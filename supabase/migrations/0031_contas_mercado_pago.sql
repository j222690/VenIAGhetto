-- 0031 — contas do Mercado Pago conectadas pelas lojas (OAuth)
--
-- PARA QUE SERVE
-- Até aqui o Vest Ai cobrava a assinatura na conta do Vest Ai. Isto é outra
-- coisa: a LOJA conecta a conta dela e passa a receber das próprias clientes
-- pelo app, com uma comissão ficando para a plataforma.
--
-- O ponto da tela é não pedir token: hoje conectar um gateway significa a
-- lojista criar conta de desenvolvedor, achar "credenciais de produção" e
-- copiar uma chave. Isso não acontece — ela desiste ou cola a chave errada.
-- Com OAuth ela clica em "Conectar", entra na conta do Mercado Pago que já
-- tem, e autoriza.
--
-- O QUE FICA GUARDADO AQUI É DINHEIRO DE OUTRA PESSOA
-- O access_token desta tabela cria cobranças em nome da loja. Vazou, o
-- atacante fatura no lugar dela. Por isso:
--   • RLS ligado e NENHUMA policy — nem o dono da loja lê a própria linha
--     pela API. Só service_role (Edge Functions) enxerga. Mesmo tratamento de
--     processed_payments.
--   • O cliente nunca precisa do token: o que a tela mostra é "conectado ou
--     não", e isso vive em stores.mp_connected_at, que já é legível por quem é
--     da loja.
-- Ao mexer nesta tabela, a pergunta é sempre: isso abre caminho para o token
-- sair daqui?

create table if not exists public.mp_accounts (
  store_id      uuid primary key references public.stores(id) on delete cascade,
  -- Id do vendedor no Mercado Pago. Serve para conferir que a conta que voltou
  -- do OAuth é a mesma de antes numa reconexão.
  mp_user_id    text not null,
  access_token  text not null,
  refresh_token text not null,
  public_key    text,
  -- false quando a loja autorizou com credenciais de teste. Cobrar de verdade
  -- com conta de teste falha em silêncio, então a tela precisa saber.
  live_mode     boolean not null default true,
  expires_at    timestamptz not null,
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.mp_accounts enable row level security;
-- Sem policies de propósito: anon/authenticated ficam sem acesso; service_role
-- ignora o RLS.

-- Só o estado da conexão é público para a loja — nunca o token.
alter table public.stores
  add column if not exists mp_connected_at timestamptz;

comment on column public.stores.mp_connected_at is
  'Quando a loja conectou o Mercado Pago (OAuth). Null = não conectada. O token fica em mp_accounts, fora do alcance do cliente.';
