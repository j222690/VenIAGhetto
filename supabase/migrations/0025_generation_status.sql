-- Vest Ai — geração em SEGUNDO PLANO (status da geração)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- POR QUE: até aqui a geração acontecia DENTRO da requisição HTTP, e o lojista
-- ficava preso na tela até a imagem sair. Isso trazia dois problemas medidos:
--
--   1. A Supabase encerra uma Edge Function síncrona em 150s (qualquer plano).
--      O Gemini leva de 11s a 131s — ou seja, o limite está DENTRO da faixa
--      normal de operação, não acima dela. Gerações lentas viravam erro.
--   2. O Google cobra a imagem mesmo quando desistimos de esperar (verificado:
--      7 de 7 requisições abandonadas voltaram com imagem completa). Cada
--      geração morta no teto era dinheiro pago e jogado fora.
--
-- Com o resultado gravado aqui, a Edge Function responde na hora e termina o
-- trabalho em background (EdgeRuntime.waitUntil, até 400s). O lojista pode
-- sair da tela e voltar depois.
--
--   status = 'processando' -> pedida, ainda gerando
--   status = 'pronta'      -> output_url preenchido
--   status = 'falhou'      -> error_message preenchido, token já reembolsado
--
-- Linhas antigas viram 'pronta': todas já têm imagem.
-- ---------------------------------------------------------------------------

alter table public.generations
  add column if not exists status text not null default 'pronta';

alter table public.generations
  add column if not exists error_message text;

-- Marca quando a geração terminou, pra medir a duração real sem depender de
-- log (created_at é quando foi PEDIDA).
alter table public.generations
  add column if not exists finished_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'generations_status_check'
  ) then
    alter table public.generations
      add constraint generations_status_check
      check (status in ('processando', 'pronta', 'falhou'));
  end if;
end $$;

-- Consulta quente: "o que ainda está processando nesta loja?" — a tela do
-- Provador e o aviso de imagem pronta batem nisso a cada poucos segundos.
create index if not exists idx_generations_store_status
  on public.generations (store_id, status)
  where status = 'processando';

-- Álbum e Histórico devem mostrar só o que ficou pronto; sem este índice a
-- listagem passaria a varrer linhas em processamento e falhas.
create index if not exists idx_generations_store_pronta
  on public.generations (store_id, created_at desc)
  where status = 'pronta';
