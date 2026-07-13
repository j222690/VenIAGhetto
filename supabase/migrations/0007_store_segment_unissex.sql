-- StyleDesk AI — adiciona o segmento "unissex" (os dois públicos)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente. Amplia stores.segment para aceitar 'unissex' além de
-- 'feminina' / 'masculina'.
-- ---------------------------------------------------------------------------

alter table public.stores
  drop constraint if exists stores_segment_check;

alter table public.stores
  add constraint stores_segment_check
  check (segment in ('feminina', 'masculina', 'unissex'));
