-- StyleDesk AI — corrige bucket `clients` para PÚBLICO
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- Bug real encontrado em produção: a migration 0005 tentava criar o bucket
-- `clients` como público, mas usava `on conflict (id) do nothing` — como o
-- bucket já existia (criado antes, como privado), o INSERT nunca aplicou o
-- `public = true`. Resultado: toda foto de cliente ficava com uma URL
-- pública que retornava 404 "Bucket not found" — a foto nunca aparecia.
-- Esta migration corrige direto, sem depender de INSERT/CONFLICT.
-- ---------------------------------------------------------------------------

update storage.buckets set public = true where id = 'clients';
