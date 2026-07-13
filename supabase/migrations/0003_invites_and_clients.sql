-- StyleDesk AI — Convites de equipe (staff) + Clientes (CRM sem login)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- NÃO edite 0001/0002 — esta migration é incremental e idempotente.
--
-- Conceitos separados:
--   • Equipe (staff) = pessoas que FAZEM LOGIN (tabela users, ligada a auth).
--     Dono (owner) = quem criou a loja. Funcionário = quem entrou por convite.
--   • Clientes      = pessoas que a loja ATENDE e NÃO fazem login (tabela
--     clients, sem qualquer ligação com auth.users).
--
-- O que faz:
--   1. store_invites — convites de funcionário (RLS: só owner/manager da loja).
--   2. handle_new_user — no signup, se houver convite pendente p/ o e-mail,
--      entra na loja existente como funcionário (NÃO cria loja nova).
--   3. clients — CRM simples por loja (RLS por loja, toda a equipe).
--   4. generations.client_id — coluna opcional p/ associar look a cliente
--      no futuro (só a coluna; sem UI agora).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. store_invites
-- ===========================================================================
create table if not exists public.store_invites (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  email       text not null,                       -- sempre em minúsculas
  role        user_role not null default 'seller',
  invited_by  uuid references public.users(id) on delete set null,
  status      text not null default 'pending',     -- pending | accepted | revoked
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

-- Busca por e-mail (case-insensitive) no trigger de signup; e por loja na UI.
create index if not exists idx_store_invites_email
  on public.store_invites (lower(email));
create index if not exists idx_store_invites_store_id
  on public.store_invites (store_id);

alter table public.store_invites enable row level security;

-- RLS — apenas owner/manager da PRÓPRIA loja podem ver/criar/alterar/excluir.
drop policy if exists store_invites_select on public.store_invites;
create policy store_invites_select on public.store_invites
  for select using (
    store_id = public.current_store_id()
    and public.current_user_role() in ('owner', 'manager')
  );

drop policy if exists store_invites_insert on public.store_invites;
create policy store_invites_insert on public.store_invites
  for insert with check (
    store_id = public.current_store_id()
    and public.current_user_role() in ('owner', 'manager')
  );

drop policy if exists store_invites_update on public.store_invites;
create policy store_invites_update on public.store_invites
  for update using (
    store_id = public.current_store_id()
    and public.current_user_role() in ('owner', 'manager')
  )
  with check (
    store_id = public.current_store_id()
    and public.current_user_role() in ('owner', 'manager')
  );

drop policy if exists store_invites_delete on public.store_invites;
create policy store_invites_delete on public.store_invites
  for delete using (
    store_id = public.current_store_id()
    and public.current_user_role() in ('owner', 'manager')
  );

-- ===========================================================================
-- 2. handle_new_user — convite tem prioridade sobre criar loja
-- ===========================================================================
-- SECURITY DEFINER: roda como dono da função (bypassa RLS), então consegue
-- LER e ATUALIZAR store_invites mesmo o novo usuário ainda não tendo linha em
-- public.users (current_store_id()/current_user_role() seriam nulos aqui).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store_id  uuid;
  pending_invite public.store_invites%rowtype;
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(new.raw_user_meta_data->>'owner_name', ''),
    initcap(replace(split_part(new.email, '@', 1), '.', ' '))
  );

  -- Convite pendente mais recente para este e-mail (case-insensitive).
  select * into pending_invite
    from public.store_invites
   where lower(email) = lower(new.email)
     and status = 'pending'
   order by created_at desc
   limit 1;

  if found then
    -- Entra na loja existente como FUNCIONÁRIO (papel do convite). Sem loja nova.
    insert into public.users (id, store_id, email, role, name)
    values (new.id, pending_invite.store_id, new.email, pending_invite.role, resolved_name);

    update public.store_invites
       set status = 'accepted', accepted_at = now()
     where id = pending_invite.id;
  else
    -- Sem convite: cria a loja e o usuário como OWNER (comportamento original).
    insert into public.stores (name, cnpj, plan, tokens_balance)
    values (
      coalesce(new.raw_user_meta_data->>'store_name', 'Minha Loja'),
      new.raw_user_meta_data->>'cnpj',
      'starter',
      0
    )
    returning id into new_store_id;

    insert into public.users (id, store_id, email, role, name)
    values (new.id, new_store_id, new.email, 'owner', resolved_name);
  end if;

  return new;
end;
$$;

-- (o trigger on_auth_user_created do 0001 continua válido — aponta para esta função)

-- ===========================================================================
-- 3. clients — CRM simples (sem login)
-- ===========================================================================
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  name       text not null,
  email      text,
  phone      text,
  notes      text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clients_store_id on public.clients (store_id);

alter table public.clients enable row level security;

-- RLS por loja — toda a equipe da loja (qualquer papel) administra clientes.
-- Vendedores são quem mais atende clientes, então não restringimos por papel;
-- o isolamento é por loja (with check no insert/update impede vazar p/ outra).
drop policy if exists clients_all_same_store on public.clients;
create policy clients_all_same_store on public.clients
  for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- ===========================================================================
-- 4. generations.client_id — preparação p/ associar look a cliente (sem UI)
-- ===========================================================================
alter table public.generations
  add column if not exists client_id uuid references public.clients(id) on delete set null;
