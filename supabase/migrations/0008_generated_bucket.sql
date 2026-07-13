-- StyleDesk AI — bucket para imagens GERADAS pela IA (Gemini)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- Bucket `generated`: guarda os resultados do Provador/Post (imagens criadas
-- pela IA). Público para LEITURA (as imagens são exibidas/compartilhadas e a
-- URL precisa ser estável). A ESCRITA é feita pela Edge Function `generate-image`
-- usando a service_role (que ignora o RLS) — nenhum cliente grava direto aqui.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('generated', 'generated', true)
on conflict (id) do nothing;
