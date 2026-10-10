-- ProveON — deixar o app apagar a imagem gerada junto com o registro
-- ---------------------------------------------------------------------------
-- Cole no SQL Editor do Supabase e execute UMA vez. Idempotente.
--
-- O PROBLEMA
-- Os buckets `catalog` e `clients` têm policy "for all" na pasta da loja, então
-- o app sempre pôde apagar neles. O `generated` (migration 0008) nunca ganhou
-- policy nenhuma: só o service_role entra. Resultado — excluir um look apagava
-- a linha e o arquivo ficava, invisível, para sempre.
--
-- A FORMA DO CAMINHO NÃO É A MESMA DOS OUTROS BUCKETS
-- Em `catalog` e `clients` a primeira pasta é o store_id, e a policy compara
-- direto com current_store_id(). Em `generated` a primeira pasta é o USER_ID
-- de quem gerou (ver gerarESubir em generate-image). Comparar com o store_id
-- não casaria nunca.
--
-- Por isso a regra aqui é: pode apagar se o dono da pasta for alguém da MESMA
-- LOJA que você. Isso reproduz exatamente a permissão que o app já dá sobre o
-- registro — `generations` é isolada por loja, não por usuário (migration
-- 0001), então um gerente apaga o look que a vendedora gerou. Se a policy
-- fosse por usuário, esse caso continuaria deixando lixo.
--
-- SELECT e INSERT seguem como estavam: a leitura é pública pelo flag do bucket
-- e quem escreve é a Edge Function com service_role. Esta policy é só DELETE.
-- ---------------------------------------------------------------------------

drop policy if exists "generated: store deletes own looks" on storage.objects;
create policy "generated: store deletes own looks" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'generated'
    and exists (
      select 1
        from public.users u
       where u.id::text = (storage.foldername(name))[1]
         and u.store_id = public.current_store_id()
    )
  );
