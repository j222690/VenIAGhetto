-- StyleDesk AI — categorias de catálogo personalizadas pela loja
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- Antes as categorias eram uma lista fixa no código (CATALOG_CATEGORIES).
-- Agora cada loja pode CRIAR categorias próprias, além das padrão — ficam
-- salvas aqui e somadas à lista fixa na tela (ver CatalogService.ts).
-- ---------------------------------------------------------------------------

create table if not exists public.catalog_categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);

create index if not exists idx_catalog_categories_store_id on public.catalog_categories (store_id);

alter table public.catalog_categories enable row level security;

-- RLS por loja — mesmo padrão de catalog_items (migration 0004): qualquer
-- membro da loja administra, isolamento é por loja via with check.
drop policy if exists catalog_categories_all_same_store on public.catalog_categories;
create policy catalog_categories_all_same_store on public.catalog_categories
  for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());
