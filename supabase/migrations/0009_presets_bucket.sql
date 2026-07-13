-- StyleDesk AI — bucket do BANCO DE IMAGENS inicial (modelos prontos)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- Bucket `presets`: modelos/fundos prontos (gerados por IA) que o app oferece
-- para lojas sem fotos próprias criarem posts. Público para leitura; escrita
-- feita apenas pela administração (service_role) — não é editável por lojas.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('presets', 'presets', true)
on conflict (id) do nothing;
