-- StyleDesk AI — fundação do backend (multi-tenant)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute uma única vez.
-- Ele cria: enums, 7 tabelas, índices, RLS multi-tenant por loja (store),
-- funções auxiliares SECURITY DEFINER (evitam recursão de policy) e o trigger
-- que cria a loja + usuário owner no cadastro.
-- ---------------------------------------------------------------------------

-- gen_random_uuid() vem da extensão pgcrypto (já presente no Supabase, mas
-- garantimos aqui para portabilidade).
create extension if not exists pgcrypto;

-- ===========================================================================
-- 1. ENUMS
-- ===========================================================================
do $$ begin
  create type plan_type as enum ('starter', 'pro', 'business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('owner', 'manager', 'seller');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_type as enum ('model', 'look', 'background', 'generated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type generation_type as enum ('provador', 'post', 'scanner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type as enum ('credit', 'debit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 2. TABELAS
-- ===========================================================================

-- stores — a loja (o tenant).
create table if not exists public.stores (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  cnpj           text,
  plan           plan_type not null default 'starter',
  tokens_balance int not null default 0,
  created_at     timestamptz not null default now()
);

-- users — perfil de aplicação ligado ao usuário do Auth.
-- O id NÃO usa default: vem de auth.users (1:1).
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  store_id   uuid not null references public.stores(id) on delete cascade,
  email      text not null,
  role       user_role not null default 'seller',
  invited_at timestamptz,
  created_at timestamptz not null default now()
);

-- assets — biblioteca de imagens (modelos, looks, fundos, geradas).
create table if not exists public.assets (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  user_id    uuid references public.users(id) on delete set null,
  type       asset_type not null,
  url        text not null,
  name       text,
  created_at timestamptz not null default now()
);

-- generations — cada geração de IA (provador, post, scanner).
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  type        generation_type not null,
  input_refs  jsonb,
  output_url  text,
  tokens_used int not null default 0,
  created_at  timestamptz not null default now()
);

-- product_sheets — fichas de produto geradas pelo scanner.
create table if not exists public.product_sheets (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  asset_id    uuid references public.assets(id) on delete set null,
  fields_json jsonb not null,
  created_at  timestamptz not null default now()
);

-- token_transactions — extrato de créditos/débitos de tokens.
create table if not exists public.token_transactions (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  type       transaction_type not null,
  amount     int not null,
  ref_id     uuid,
  created_at timestamptz not null default now()
);

-- subscriptions — estado da assinatura da loja.
create table if not exists public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  plan         plan_type not null,
  status       subscription_status not null default 'trialing',
  next_billing timestamptz,
  payment_ref  text,
  created_at   timestamptz not null default now()
);

-- ===========================================================================
-- 3. ÍNDICES (todas as colunas store_id)
-- ===========================================================================
create index if not exists idx_users_store_id              on public.users(store_id);
create index if not exists idx_assets_store_id             on public.assets(store_id);
create index if not exists idx_generations_store_id        on public.generations(store_id);
create index if not exists idx_product_sheets_store_id     on public.product_sheets(store_id);
create index if not exists idx_token_transactions_store_id on public.token_transactions(store_id);
create index if not exists idx_subscriptions_store_id      on public.subscriptions(store_id);

-- ===========================================================================
-- 4. FUNÇÕES AUXILIARES (SECURITY DEFINER — ignoram RLS, evitam recursão)
-- ===========================================================================

-- Retorna o store_id do usuário autenticado.
create or replace function public.current_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from public.users where id = auth.uid()
$$;

-- Retorna o role do usuário autenticado.
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

-- ===========================================================================
-- 5. RLS — ativar em todas as 7 tabelas
-- ===========================================================================
alter table public.stores             enable row level security;
alter table public.users              enable row level security;
alter table public.assets             enable row level security;
alter table public.generations        enable row level security;
alter table public.product_sheets     enable row level security;
alter table public.token_transactions enable row level security;
alter table public.subscriptions      enable row level security;

-- ---- stores --------------------------------------------------------------
drop policy if exists stores_select_own on public.stores;
create policy stores_select_own on public.stores
  for select using (id = public.current_store_id());

drop policy if exists stores_update_own on public.stores;
create policy stores_update_own on public.stores
  for update using (id = public.current_store_id())
  with check (id = public.current_store_id());

-- ---- users ---------------------------------------------------------------
-- Todos da mesma loja podem ler os colegas.
drop policy if exists users_select_same_store on public.users;
create policy users_select_same_store on public.users
  for select using (store_id = public.current_store_id());

-- Apenas owner/manager podem alterar usuários da loja.
drop policy if exists users_update_managers on public.users;
create policy users_update_managers on public.users
  for update
  using (
    store_id = public.current_store_id()
    and public.current_user_role() in ('owner', 'manager')
  )
  with check (
    store_id = public.current_store_id()
    and public.current_user_role() in ('owner', 'manager')
  );

-- Apenas owner/manager podem remover usuários da loja.
drop policy if exists users_delete_managers on public.users;
create policy users_delete_managers on public.users
  for delete
  using (
    store_id = public.current_store_id()
    and public.current_user_role() in ('owner', 'manager')
  );

-- ---- helper macro: tabelas "filhas" filtradas só por store_id -------------
-- assets
drop policy if exists assets_all_same_store on public.assets;
create policy assets_all_same_store on public.assets
  for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- generations
drop policy if exists generations_all_same_store on public.generations;
create policy generations_all_same_store on public.generations
  for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- product_sheets
drop policy if exists product_sheets_all_same_store on public.product_sheets;
create policy product_sheets_all_same_store on public.product_sheets
  for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- token_transactions
drop policy if exists token_transactions_all_same_store on public.token_transactions;
create policy token_transactions_all_same_store on public.token_transactions
  for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- subscriptions
drop policy if exists subscriptions_all_same_store on public.subscriptions;
create policy subscriptions_all_same_store on public.subscriptions
  for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- ===========================================================================
-- 6. CADASTRO AUTOMÁTICO — trigger no auth.users
-- ===========================================================================
-- No signup: cria uma loja nova (starter, 0 tokens) e insere o usuário como
-- owner dessa loja. Roda como SECURITY DEFINER para contornar o RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store_id uuid;
begin
  insert into public.stores (name, cnpj, plan, tokens_balance)
  values (
    coalesce(new.raw_user_meta_data->>'store_name', 'Minha Loja'),
    new.raw_user_meta_data->>'cnpj',
    'starter',
    0
  )
  returning id into new_store_id;

  insert into public.users (id, store_id, email, role)
  values (new.id, new_store_id, new.email, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
