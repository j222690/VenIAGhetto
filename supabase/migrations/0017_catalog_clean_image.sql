-- StyleDesk AI — foto LIMPA da peça (isolada, sem fundo/modelo)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- O que faz: adiciona catalog_items.clean_image_url — versão da foto da peça
-- gerada por IA (opcional, ação manual do lojista "Limpar peça"), com fundo
-- e eventual modelo removidos, só a peça isolada. Usada como referência mais
-- confiável no Provador (evita a IA confundir peça com pessoa da foto
-- original). A foto original (image_url) nunca é sobrescrita.
-- ---------------------------------------------------------------------------

alter table public.catalog_items
  add column if not exists clean_image_url text;
