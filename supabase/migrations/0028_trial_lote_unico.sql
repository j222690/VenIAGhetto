-- Vest Ai — teste grátis: 35 créditos de uma vez (substitui a cota diária)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente. Depende da 0027 (colunas trial_ends_at / trial_last_grant_on).
--
-- POR QUE MUDOU: a 0027 dava 5 por dia durante 7 dias. Isso criava uma
-- dependência da virada do dia — se a concessão falhasse num dia, o lojista
-- simplesmente ficava sem, e o erro seria silencioso e difícil de perceber.
-- Um lote único não tem esse modo de falha: concede uma vez, e pronto.
--
-- O total é o mesmo (5 × 7 = 35) e a mensagem fica mais fácil de entender:
-- "você ganhou 35 créditos para testar" em vez de explicar uma cota que
-- renova. O prazo de 7 dias continua valendo — os créditos não expiram por
-- si, mas depois do prazo não entra mais nada.
--
-- Aqui SOMA em vez de elevar até o valor (a 0027 elevava, para a cota diária
-- não acumular). Como agora acontece UMA única vez, somar é o certo: quem
-- comprou créditos antes não perde o que tinha.
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
  lote   constant int := 35;  -- 7 dias × a cota diária do Starter (149/30 ≈ 5)
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

  -- Sem teste, teste vencido, ou lote já entregue: devolve o saldo real.
  if fim is null or now() > fim or ja is not null then
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

-- As lojas que já receberam a cota diária de 5 sob a regra antiga recebem a
-- diferença, para não ficarem com menos que quem entra agora. Só as que ainda
-- estão dentro do prazo.
update public.stores
   set tokens_balance = tokens_balance + 30
 where trial_ends_at is not null
   and now() <= trial_ends_at
   and trial_last_grant_on is not null
   and tokens_balance <= 5;
