-- StyleDesk AI — segmento da loja (feminina / masculina)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- Adiciona `stores.segment`, usado pelo app para escolher o esquema de cores
-- neon (feminina = rosa/roxo, masculina = azul/verde). O trigger de cadastro
-- passa a ler `segment` do metadata do usuário (default 'feminina').
-- ---------------------------------------------------------------------------

alter table public.stores
  add column if not exists segment text not null default 'feminina';

-- Restringe aos dois valores suportados (idempotente).
do $$ begin
  alter table public.stores
    add constraint stores_segment_check check (segment in ('feminina', 'masculina'));
exception when duplicate_object then null; end $$;

-- Atualiza o trigger de cadastro para persistir o segmento escolhido no signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store_id uuid;
begin
  insert into public.stores (name, cnpj, plan, tokens_balance, segment)
  values (
    coalesce(new.raw_user_meta_data->>'store_name', 'Minha Loja'),
    new.raw_user_meta_data->>'cnpj',
    'starter',
    0,
    coalesce(new.raw_user_meta_data->>'segment', 'feminina')
  )
  returning id into new_store_id;

  insert into public.users (id, store_id, email, role)
  values (new.id, new_store_id, new.email, 'owner');

  return new;
end;
$$;
