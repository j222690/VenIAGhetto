// Apaga do Storage os arquivos de um registro que acabou de ser excluído.
//
// A ORDEM IMPORTA, E É SEMPRE: LINHA PRIMEIRO, ARQUIVO DEPOIS.
// Se o arquivo sumisse antes e a exclusão da linha falhasse, sobraria um
// registro apontando para um arquivo que não existe — imagem quebrada na tela
// do lojista. Na ordem inversa, o pior caso é um arquivo órfão, que é
// invisível e que a faxina recolhe depois. Entre um defeito visível e um
// desperdício invisível, escolhe-se o desperdício.
//
// Por isso esta função NUNCA lança. Ela é o remate de uma exclusão que já deu
// certo; falhar aqui não pode desfazer nem atrapalhar o que o lojista pediu.
import { supabase } from "@/integrations/supabase/client";
import { agrupaPorBucket } from "@/lib/storagePath";

export async function apagaArquivos(urls: (string | null | undefined)[]): Promise<void> {
  const porBucket = agrupaPorBucket(urls);
  if (porBucket.size === 0) return;

  await Promise.all(
    [...porBucket].map(async ([bucket, caminhos]) => {
      try {
        await supabase.storage.from(bucket).remove(caminhos);
      } catch {
        // Sem policy, sem rede, arquivo de outra loja: a faxina pega depois.
      }
    }),
  );
}
