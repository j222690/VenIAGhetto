-- StyleDesk AI — Perfil da loja + nome de usuário + favoritos de looks
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- NÃO edite o 0001_init.sql — esta migration é incremental e idempotente
-- (usa "if not exists" / "or replace", pode rodar de novo sem quebrar).
--
-- O que faz:
--   1. users.name  — nome real do usuário (antes era derivado do e-mail).
--   2. stores.*    — colunas de perfil público da loja (logo, sobre, contato).
--   3. generations.is_favorite — favoritar look (por LOJA; RLS já cobre).
--   4. atualiza o trigger de signup para gravar o nome do dono.
-- RLS: nenhuma policy nova é necessária —
--   - users      → users_update_managers (owner/manager) já cobre edição.
--   - stores     → stores_update_own já cobre edição da loja.
--   - generations→ generations_all_same_store (FOR ALL) já cobre o update
--                  de is_favorite, restrito à loja do usuário logado.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. users.name
-- ===========================================================================
alter table public.users
  add column if not exists name text;

-- Backfill: para linhas antigas sem nome, deriva do local-part do e-mail
-- (mesma lógica de displayNameFromEmail, em SQL, só para não ficar vazio).
update public.users
   set name = initcap(replace(split_part(email, '@', 1), '.', ' '))
 where name is null;

-- ===========================================================================
-- 2. stores — perfil público da loja
-- ===========================================================================
alter table public.stores
  add column if not exists logo_url    text,
  add column if not exists description text,
  add column if not exists location    text,
  add column if not exists phone       text,
  add column if not exists email       text,
  add column if not exists instagram   text;

-- ===========================================================================
-- 3. generations.is_favorite — favorito por loja
-- ===========================================================================
alter table public.generations
  add column if not exists is_favorite boolean not null default false;

-- Índice parcial: acelera "listar favoritos da loja".
create index if not exists idx_generations_favorite
  on public.generations(store_id)
  where is_favorite;

-- ===========================================================================
-- 4. Trigger de signup — passa a gravar o nome do dono
-- ===========================================================================
-- Lê raw_user_meta_data->>'owner_name' (enviado pelo cadastro). Se ausente,
-- deriva do e-mail. Mantém o resto do comportamento do 0001 intacto.
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

  insert into public.users (id, store_id, email, role, name)
  values (
    new.id,
    new_store_id,
    new.email,
    'owner',
    coalesce(
      nullif(new.raw_user_meta_data->>'owner_name', ''),
      initcap(replace(split_part(new.email, '@', 1), '.', ' '))
    )
  );

  return new;
end;
$$;
