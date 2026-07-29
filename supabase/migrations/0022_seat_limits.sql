-- Vest Ai — Limite de usuários por plano (seats)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- NÃO edite migrations anteriores — esta é incremental e idempotente.
--
-- Antes de hoje, `maxUsers` em src/constants/plans.ts era decorativo — nada
-- impedia convidar mais gente do que o plano permite. Esta migration passa a
-- aplicar o limite de verdade no BANCO (não só no frontend, que dá pra
-- contornar chamando a API direto) — bloqueia a CRIAÇÃO do convite (função
-- handle_new_user de 0003/0015 continua igual, só o convite em si passa a ser
-- negado antes de existir).
--
-- Limites atuais (espelham src/constants/plans.ts — se mudar lá, mudar aqui):
--   starter = 3 · pro = 10 · business = 25
-- Contagem = membros ativos (users) + convites pendentes (store_invites), pra
-- não deixar acumular convites além do limite antes de serem aceitos.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  store_plan     plan_type;
  max_seats      int;
  current_seats  int;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select plan into store_plan from public.stores where id = new.store_id;

  max_seats := case store_plan
    when 'starter' then 3
    when 'pro' then 10
    when 'business' then 25
    else 3
  end;

  select
    (select count(*) from public.users where store_id = new.store_id)
    + (select count(*) from public.store_invites where store_id = new.store_id and status = 'pending')
    into current_seats;

  if current_seats >= max_seats then
    raise exception
      'Limite de usuários do plano atingido (%/%). Remova alguém da equipe ou faça upgrade de plano.',
      current_seats, max_seats;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_seat_limit on public.store_invites;
create trigger trg_enforce_seat_limit
  before insert on public.store_invites
  for each row execute function public.enforce_seat_limit();
