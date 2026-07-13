-- StyleDesk AI — Catálogo de peças da loja
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- NÃO edite as migrations anteriores. Idempotente (if not exists / or replace).
--
-- O que faz:
--   1. catalog_items — peças que a loja cadastra (RLS por loja).
--   2. generations — garante client_id e tokens_used (já criados em 0001/0003;
--      reasseguramos aqui para a migration ser autossuficiente).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. catalog_items
-- ===========================================================================
create table if not exists public.catalog_items (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  name        text not null,
  category    text,
  price       numeric,
  image_url   text,
  description text,
  sku         text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_catalog_items_store_id on public.catalog_items (store_id);

alter table public.catalog_items enable row level security;

-- RLS por loja — select/insert/update/delete só da própria loja, com with check.
drop policy if exists catalog_items_all_same_store on public.catalog_items;
create policy catalog_items_all_same_store on public.catalog_items
  for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- ===========================================================================
-- 2. generations — garante colunas usadas pelo Provador
-- ===========================================================================
-- client_id: associa um look a um cliente (criado em 0003; reasseguramos).
alter table public.generations
  add column if not exists client_id uuid references public.clients(id) on delete set null;

-- tokens_used: custo da geração (criado em 0001 com default 0; reforço).
alter table public.generations
  add column if not exists tokens_used int not null default 0;
