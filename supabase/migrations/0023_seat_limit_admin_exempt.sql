-- Vest Ai — Isenta o admin da plataforma do limite de usuários por plano
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Depende de 0022_seat_limits.sql já ter sido aplicada.
--
-- Pedido: quem está logado na loja do admin (loja de testes/demo) OU quem for
-- convidado PELO admin (ex.: ajudando um cliente a montar a equipe) tem
-- acesso ilimitado, sem entrar na contagem do limite do plano. Mesmo e-mail
-- do gate de "uso da plataforma" em src/routes/profile.tsx / secret
-- ADMIN_EMAILS do admin-stats — se esse e-mail mudar, mudar aqui também.
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
  is_admin       boolean;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select
    exists(
      select 1 from public.users
       where id = auth.uid()
         and lower(email) = 'victor@styledesk.app'
    )
    or exists(
      select 1 from public.users
       where store_id = new.store_id
         and role = 'owner'
         and lower(email) = 'victor@styledesk.app'
    )
    into is_admin;

  if is_admin then
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
