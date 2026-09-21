-- Vest Ai — teste grátis: 10 gerações, sem prazo
-- ---------------------------------------------------------------------------
-- Cole no SQL Editor do Supabase e execute UMA vez. Idempotente.
--
-- O QUE MUDA
-- Eram 35 créditos liberados dentro de uma janela de 7 dias. Agora são 10, e
-- o prazo deixa de existir como regra.
--
-- POR QUE TIRAR O PRAZO
-- Ele já quase não fazia nada: o lote é entregue de uma vez, na primeira vez
-- que a loja abre o app, e os créditos nunca expiraram por conta própria. O
-- que a janela realmente fazia era criar um modo de falha silencioso — quem
-- criasse a conta e só abrisse o app oito dias depois recebia ZERO, sem
-- nenhuma tela explicando. Com o limite em gerações, a promessa que o site faz
-- ("10 gerações grátis") é exatamente a regra que o banco executa.
--
-- `trial_ends_at` continua na tabela de propósito: ela ainda registra quando a
-- loja entrou e é lida por telas e relatórios. O que sai é o poder de veto
-- dela sobre o lote.
-- ---------------------------------------------------------------------------

create or replace function public.grant_trial_tokens()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  sid    uuid;
  fim    timestamptz;
  ja     date;
  saldo  int;
  lote   constant int := 10;
begin
  sid := public.current_store_id();
  if sid is null then
    return 0;
  end if;

  select trial_ends_at, trial_last_grant_on, tokens_balance
    into fim, ja, saldo
    from public.stores
   where id = sid
     for update;

  -- Loja sem teste (assinante, ou criada antes da 0027) ou lote já entregue:
  -- devolve o saldo real. A DATA não entra mais nesta decisão — só o fato de
  -- já ter recebido, que é o que impede receber duas vezes.
  if fim is null or ja is not null then
    return coalesce(saldo, 0);
  end if;

  update public.stores
     set tokens_balance = coalesce(tokens_balance, 0) + lote,
         trial_last_grant_on = current_date
   where id = sid
   returning tokens_balance into saldo;

  insert into public.token_transactions (store_id, type, amount)
  values (sid, 'credit', lote);

  return saldo;
end;
$$;

revoke all on function public.grant_trial_tokens() from public;
grant execute on function public.grant_trial_tokens() to authenticated;
