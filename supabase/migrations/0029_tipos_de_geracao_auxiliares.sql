-- Vest Ai — tipos de geração para Refino, Limpar imagem e Criar corpo
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente (ADD VALUE IF NOT EXISTS).
--
-- POR QUE: essas três funções chamavam a IA pelo caminho SÍNCRONO, e a
-- Supabase encerra uma Edge Function síncrona em 150s. O Gemini leva de 11s a
-- 131s — o limite cai DENTRO da faixa normal de operação. Como o Google cobra
-- a imagem mesmo quando desistimos de esperar (medido: 7 de 7 requisições
-- abandonadas voltaram com a imagem pronta), cada estouro de teto era imagem
-- paga e jogada fora, e o token do lojista ia junto sem reembolso.
--
-- O caminho ASSÍNCRONO resolve os três de uma vez: 400s de orçamento, o
-- resultado gravado numa linha de `generations`, reembolso automático quando
-- falha e aviso por push quando termina. Mas ele precisa de uma linha — e o
-- `type` dela é este enum. Daí os três valores novos.
--
-- Essas linhas NÃO são look do álbum: refino é uma versão de uma geração que
-- já existe, limpeza é foto de peça do catálogo e corpo é foto de cliente. O
-- app filtra o álbum por ('provador','post','scanner') — ver
-- GenerationService.load().
-- ---------------------------------------------------------------------------

alter type generation_type add value if not exists 'refino';
alter type generation_type add value if not exists 'limpeza';
alter type generation_type add value if not exists 'corpo';
