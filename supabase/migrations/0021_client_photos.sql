-- StyleDesk AI — galeria de fotos do cliente (várias, não só a foto-base)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- clients.photo_url (migration 0014) continua sendo a foto-BASE (a que
-- pré-preenche o Provador). Esta tabela guarda fotos ADICIONAIS do cliente,
-- que a loja sobe depois de já ter cadastrado ele (na pasta do cliente) —
-- não dá pra subir mais de uma foto no cadastro inicial, então isso resolve.
-- Qualquer uma da galeria pode virar a foto-base (ver ClientService.setBasePhoto).
-- ---------------------------------------------------------------------------

create table if not exists public.client_photos (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  url        text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_photos_client_id on public.client_photos (client_id);
create index if not exists idx_client_photos_store_id on public.client_photos (store_id);

alter table public.client_photos enable row level security;

-- RLS por loja — mesmo padrão de clients (adicionar/ver/excluir foto é
-- liberado pra equipe toda; a foto em si não é dado tão sensível quanto
-- excluir o cadastro do cliente, que continua restrito ao dono).
drop policy if exists client_photos_all_same_store on public.client_photos;
create policy client_photos_all_same_store on public.client_photos
  for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());
