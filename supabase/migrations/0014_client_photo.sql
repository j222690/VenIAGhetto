-- StyleDesk AI — foto BASE do cliente (usada no Provador)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- O que faz:
--   1. clients.photo_url — a foto do cliente cadastrada no CRM, usada como
--      ponto de partida no Provador (evita reenviar a foto toda vez). Guardada
--      no bucket `clients` (mesmo bucket/isolamento por loja de 0005).
--   2. clients.instagram — o cadastro passa a pedir o Instagram do cliente em
--      vez do e-mail (coluna `email` de 0003 fica preservada, sem uso na UI).
-- ---------------------------------------------------------------------------

alter table public.clients
  add column if not exists photo_url text;

alter table public.clients
  add column if not exists instagram text;
