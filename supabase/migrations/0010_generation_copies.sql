-- StyleDesk AI — salva a legenda (copy) da geração junto no histórico/álbum
-- ---------------------------------------------------------------------------
-- Cole no SQL Editor e execute UMA vez. Idempotente.
-- Guarda o conjunto de legendas (instagram/whatsapp/facebook + hashtags + cta)
-- gerado por IA para o post, para que a descrição fique salva com a imagem.
-- ---------------------------------------------------------------------------

alter table public.generations
  add column if not exists copies jsonb;
