-- 0031 — conta do Mercado Pago que recebe o faturamento (OAuth)
--
-- PARA QUE SERVE
-- Guardar a conta do DONO DO APP, para onde vão as assinaturas e os pacotes
-- que os lojistas pagam. Antes isso era um access token colado num secret, o
-- que obrigava quem é dono a criar conta de desenvolvedor, achar "credenciais
-- de produção", escolher a chave certa entre quatro parecidas e trocá-la na
-- mão quando mudasse. Com OAuth ele clica em Conectar e autoriza na conta que
-- já usa.
--
-- NÃO É UMA CONTA POR LOJA. Lojista nenhum conecta nada: ele só paga. Na
-- prática esta tabela tem uma linha só — a chave por store_id existe porque a
-- conexão é feita de dentro de uma loja (a do app) e isso amarra as duas
-- pontas sem inventar tabela de configuração global.
--
-- O QUE FICA GUARDADO AQUI É DINHEIRO DE OUTRA PESSOA
-- O access_token desta tabela cria cobranças em nome de quem conectou. Vazou,
-- o atacante fatura no lugar dele. Por isso:
--   • RLS ligado e NENHUMA policy — nem o dono da loja lê a própria linha
--     pela API. Só service_role (Edge Functions) enxerga. Mesmo tratamento de
--     processed_payments.
--   • O cliente nunca precisa do token: o que a tela mostra é "conectado ou
--     não", e isso vive em stores.mp_connected_at, que já é legível por quem é
--     da loja.
--   • Quem pode conectar é conferido no servidor pelo secret ADMIN_STORE_ID
--     (Edge Function mercadopago-oauth), não pelo frontend.
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
  'Quando o dono do app conectou o Mercado Pago (OAuth). Null = não conectada. Só a loja do app usa esta coluna; o token fica em mp_accounts, fora do alcance do cliente.';
