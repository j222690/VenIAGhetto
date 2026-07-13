-- StyleDesk AI — Supabase Storage (fotos de catálogo e de clientes)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- NÃO edite as migrations anteriores. Idempotente.
--
-- O que faz:
--   1. Cria 2 buckets: `catalog` (fotos de peças) e `clients` (fotos de
--      clientes). Ambos PÚBLICOS para leitura — ver justificativa abaixo.
--   2. Policies em storage.objects que ISOLAM por loja: cada loja só pode
--      enviar/alterar/excluir arquivos dentro da sua própria "pasta", cujo
--      nome é o store_id (caminho `store_id/arquivo`).
--
-- Por que buckets PÚBLICOS (leitura) + escrita isolada?
--   • As imagens são feitas para serem EXIBIDAS no app e COMPARTILHADAS
--     (catálogo, álbum, posts). URL pública = URL estável: gravamos
--     catalog_items.image_url uma vez e ela não expira (signed URLs expiram).
--   • A ESCRITA continua isolada: pelas policies abaixo, uma loja não consegue
--     gravar, sobrescrever, listar nem apagar nada fora da pasta do próprio
--     store_id. Uma loja não acessa (via API) os arquivos de outra.
--   • A leitura é por URL pública não-adivinhável (uuid no nome) — padrão de
--     imagem de produto/marketing. Se um dia for preciso leitura privada,
--     basta tornar os buckets privados e gerar signed URLs no StorageService.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Buckets
-- ===========================================================================
insert into storage.buckets (id, name, public)
values
  ('catalog', 'catalog', true),
  ('clients', 'clients', true)
on conflict (id) do nothing;

-- ===========================================================================
-- 2. Policies de isolamento por loja (storage.objects)
-- ===========================================================================
-- `storage.foldername(name)` divide o caminho em segmentos; o primeiro ([1])
-- é a pasta raiz, que padronizamos como o store_id. Comparamos com o store_id
-- do usuário autenticado (public.current_store_id(), criada na migration 0001).

-- ---- bucket `catalog` ----------------------------------------------------
drop policy if exists "catalog: store manages own folder" on storage.objects;
create policy "catalog: store manages own folder" on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'catalog'
    and (storage.foldername(name))[1] = public.current_store_id()::text
  )
  with check (
    bucket_id = 'catalog'
    and (storage.foldername(name))[1] = public.current_store_id()::text
  );

-- ---- bucket `clients` ----------------------------------------------------
drop policy if exists "clients: store manages own folder" on storage.objects;
create policy "clients: store manages own folder" on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'clients'
    and (storage.foldername(name))[1] = public.current_store_id()::text
  )
  with check (
    bucket_id = 'clients'
    and (storage.foldername(name))[1] = public.current_store_id()::text
  );

-- Observações:
--   • Leitura pública é servida pelo flag `public = true` do bucket (CDN), sem
--     depender destas policies. As policies acima governam INSERT/UPDATE/DELETE
--     (e qualquer SELECT via API autenticada), sempre restritos à pasta da loja.
--   • Não criamos policy de leitura pública explícita: o bucket público já a
--     fornece. Para tornar privado no futuro, mude `public` para false e
--     adicione uma policy de SELECT análoga (mesmo filtro por store_id).
