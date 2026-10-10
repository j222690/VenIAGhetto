-- ProveON — faxina de Storage: encontrar arquivo que ninguém usa
-- ---------------------------------------------------------------------------
-- Cole no SQL Editor do Supabase e execute UMA vez. Idempotente.
--
-- O PROBLEMA
-- O Storage chegou a 985 MB (teto de 1 GB) e 543 MB disso é arquivo que NADA
-- referencia: sobra de importação que o lojista não chegou a salvar, e imagem
-- de item/look que ele excluiu — porque o app apaga a linha do banco e deixa
-- o arquivo para trás.
--
-- POR QUE A REGRA MORA AQUI, E NÃO NA EDGE FUNCTION
-- Decidir "ninguém usa este arquivo" é uma pergunta sobre o banco inteiro, e
-- errar nela apaga foto de cliente. Em SQL ela fica legível, testável com um
-- SELECT antes de qualquer exclusão, e num lugar só. A primeira versão desta
-- consulta esquecia `generations.input_refs` e classificava como lixo 125
-- fotos de cliente que são a ENTRADA de looks que ainda estão no histórico.
--
-- A LISTA DE REFERÊNCIAS É A PARTE PERIGOSA
-- Toda coluna que possa guardar uma URL de Storage precisa estar aqui. Se uma
-- faltar, os arquivos dela viram "órfãos" e somem. Ao criar coluna nova que
-- guarde URL, acrescente-a em `public.storage_referencias()`.
-- ---------------------------------------------------------------------------

-- Toda URL de Storage que o banco conhece, numa coluna só.
create or replace function public.storage_referencias()
returns table (u text)
language sql
stable
security definer
set search_path = public
as $$
  select output_url      from public.generations   where output_url is not null
  union all
  select input_refs::text from public.generations  where input_refs is not null
  union all
  select copies::text    from public.generations   where copies is not null
  union all
  select url             from public.assets        where url is not null
  union all
  select image_url       from public.catalog_items where image_url is not null
  union all
  select clean_image_url from public.catalog_items where clean_image_url is not null
  union all
  select photo_url       from public.clients       where photo_url is not null
  union all
  select url             from public.client_photos where url is not null
  union all
  select logo_url        from public.stores        where logo_url is not null
  union all
  select fields_json::text from public.product_sheets where fields_json is not null
$$;

-- Quanto cada bucket ocupa, e quanto disso ninguém usa.
create or replace function public.storage_uso()
returns table (
  bucket     text,
  arquivos   bigint,
  mb         numeric,
  orfaos     bigint,
  orfaos_mb  numeric
)
language sql
stable
security definer
set search_path = public, storage
as $$
  with o as (
    select obj.bucket_id,
           coalesce((obj.metadata->>'size')::bigint, 0) as bytes,
           not exists (
             select 1 from public.storage_referencias() r
              where position(obj.name in r.u) > 0
           ) as sobra
      from storage.objects obj
  )
  select bucket_id,
         count(*),
         round(sum(bytes) / 1048576.0, 1),
         count(*) filter (where sobra),
         round(coalesce(sum(bytes) filter (where sobra), 0) / 1048576.0, 1)
    from o
   group by bucket_id
   order by 3 desc;
$$;

-- Os caminhos a apagar, em lote.
--
-- `p_idade_horas` existe para não apagar arquivo recém-subido: entre o upload
-- e o INSERT da linha que o referencia há uma janela de segundos em que o
-- arquivo é, tecnicamente, órfão. 24h é folga de sobra.
create or replace function public.storage_orfaos(
  p_bucket      text,
  p_limite      int  default 100,
  p_idade_horas int  default 24
)
returns table (name text, bytes bigint)
language sql
stable
security definer
set search_path = public, storage
as $$
  select obj.name, coalesce((obj.metadata->>'size')::bigint, 0)
    from storage.objects obj
   where obj.bucket_id = p_bucket
     and obj.created_at < now() - make_interval(hours => p_idade_horas)
     and not exists (
       select 1 from public.storage_referencias() r
        where position(obj.name in r.u) > 0
     )
   order by coalesce((obj.metadata->>'size')::bigint, 0) desc
   limit p_limite;
$$;

-- Registro do que foi apagado. Sem isto, uma faxina errada é indetectável.
create table if not exists public.storage_faxina_log (
  id         uuid primary key default gen_random_uuid(),
  bucket     text        not null,
  name       text        not null,
  bytes      bigint      not null default 0,
  apagado_em timestamptz not null default now()
);

alter table public.storage_faxina_log enable row level security;
-- Sem policy: só service_role entra. É registro de operação, não dado de loja.

revoke all on function public.storage_referencias() from public, anon, authenticated;
revoke all on function public.storage_uso()          from public, anon, authenticated;
revoke all on function public.storage_orfaos(text, int, int) from public, anon, authenticated;
grant execute on function public.storage_referencias() to service_role;
grant execute on function public.storage_uso()         to service_role;
grant execute on function public.storage_orfaos(text, int, int) to service_role;
