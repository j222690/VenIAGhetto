-- Vest Ai — teste grátis de 7 dias
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- REGRA DE PRODUTO: durante 7 dias o lojista recebe a mesma cota DIÁRIA do
-- plano Starter — 149 gerações/mês ÷ 30 = 5 por dia. Acabados os 7 dias, nada
-- é bloqueado: ele simplesmente para de receber a cota e fica sem saldo, o que
-- já impede gerar pelo caminho normal (`debit_tokens` recusa sem saldo).
--
-- POR DIA, e não 35 de uma vez, de propósito: um lote único seria gasto na
-- primeira sessão e o lojista não voltaria nos outros dias — que é justamente
-- o que um teste de 7 dias precisa provocar. Também limita o prejuízo se
-- alguém criar conta só para experimentar e sumir.
--
-- A cota NÃO acumula: cada dia o saldo é elevado ATÉ a cota, não somado a ela.
-- Sem isso, quem some por 5 dias voltaria com 25 gerações de uma vez.
-- ---------------------------------------------------------------------------

alter table public.stores
  add column if not exists trial_ends_at timestamptz;

-- Último dia em que a cota do teste foi concedida (evita conceder 2x no
-- mesmo dia — a função é chamada toda vez que o app abre).
alter table public.stores
  add column if not exists trial_last_grant_on date;

comment on column public.stores.trial_ends_at is
  'Fim do teste grátis de 7 dias. NULL = loja sem teste (criada antes desta migration ou já assinante).';

-- ---------------------------------------------------------------------------
-- Concede a cota diária do teste.
--
-- security definer porque MEXE EM SALDO: se isso fosse possível pelo cliente,
-- qualquer um chamando a API direto se daria tokens infinitos. A função é a
-- única porta, e ela mesma decide se a loja tem direito.
--
-- Devolve o saldo resultante (ou o atual, se não houve concessão).
-- ---------------------------------------------------------------------------
create or replace function public.grant_trial_tokens()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  sid       uuid;
  fim       timestamptz;
  ultimo    date;
  saldo     int;
  cota      constant int := 5;  -- Starter: 149/mês ÷ 30 dias
begin
  sid := public.current_store_id();
  if sid is null then
    return 0;
  end if;

  select trial_ends_at, trial_last_grant_on, tokens_balance
    into fim, ultimo, saldo
    from public.stores
   where id = sid
     for update;

  -- Sem teste, ou teste vencido: não concede nada e devolve o saldo real.
  if fim is null or now() > fim then
    return coalesce(saldo, 0);
  end if;

  -- Já concedido hoje.
  if ultimo is not null and ultimo >= current_date then
    return coalesce(saldo, 0);
  end if;

  -- ELEVA até a cota (não soma): a cota do dia não acumula com a de ontem.
  -- greatest evita tirar saldo de quem comprou tokens durante o teste.
  update public.stores
     set tokens_balance = greatest(coalesce(tokens_balance, 0), cota),
         trial_last_grant_on = current_date
   where id = sid
   returning tokens_balance into saldo;

  insert into public.token_transactions (store_id, type, amount)
  values (sid, 'credit', cota);

  return saldo;
end;
$$;

revoke all on function public.grant_trial_tokens() from public;
grant execute on function public.grant_trial_tokens() to authenticated;

-- ---------------------------------------------------------------------------
-- Lojas NOVAS já nascem em teste. Reescreve só o INSERT de stores dentro do
-- handle_new_user (migration 0015) — o resto do gatilho segue igual.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store_id   uuid;
  pending_invite public.store_invites%rowtype;
  resolved_name  text;
  meta_token     text;
begin
  resolved_name := coalesce(
    nullif(new.raw_user_meta_data->>'owner_name', ''),
    initcap(replace(split_part(new.email, '@', 1), '.', ' '))
  );

  meta_token := nullif(new.raw_user_meta_data->>'invite_token', '');

  -- 1) Convite por LINK (token) — ignora e-mail.
  if meta_token is not null then
    begin
      select * into pending_invite
        from public.store_invites
       where token = meta_token::uuid
         and status = 'pending'
       limit 1;
    exception when invalid_text_representation then
      -- token malformado: segue para o fluxo por e-mail abaixo.
      null;
    end;
  end if;

  -- 2) Sem token válido: convite por E-MAIL mais recente (fluxo original).
  if not found then
    select * into pending_invite
      from public.store_invites
     where lower(email) = lower(new.email)
       and status = 'pending'
     order by created_at desc
     limit 1;
  end if;

  if found then
    -- Funcionário entrando numa loja existente: herda o teste (ou a
    -- assinatura) da loja, não ganha um teste próprio.
    insert into public.users (id, store_id, email, role, name)
    values (new.id, pending_invite.store_id, new.email, pending_invite.role, resolved_name);

    update public.store_invites
       set status = 'accepted', accepted_at = now()
     where id = pending_invite.id;
  else
    -- ÚNICA diferença em relação à 0019: trial_ends_at. O resto é idêntico,
    -- inclusive os nullif() que a 0019 acrescentou pra não criar loja com
    -- nome/CNPJ vazio — reescrever a função exige repetir tudo.
    -- Saldo começa em 0: a primeira cota entra quando o app abre e chama
    -- grant_trial_tokens().
    insert into public.stores (name, cnpj, plan, tokens_balance, trial_ends_at)
    values (
      coalesce(nullif(new.raw_user_meta_data->>'store_name', ''), 'Minha Loja'),
      nullif(new.raw_user_meta_data->>'cnpj', ''),
      'starter',
      0,
      now() + interval '7 days'
    )
    returning id into new_store_id;

    insert into public.users (id, store_id, email, role, name)
    values (new.id, new_store_id, new.email, 'owner', resolved_name);
  end if;

  return new;
end;
$$;
