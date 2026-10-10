// Traduz a URL pública de um arquivo no Storage de volta para { bucket, path }.
//
// POR QUE PRECISA EXISTIR
// O banco guarda a URL inteira, mas a API de exclusão do Storage quer o bucket
// e o caminho dentro dele, separados. Sem esta tradução o app só conseguia
// apagar a linha — e foi assim que 543 MB de arquivo invisível se acumularam.
//
// Formato servido pelo Supabase:
//   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<caminho...>
// Há também /object/sign/ e /render/image/public/ (miniatura), com a mesma
// estrutura depois do marcador — por isso a regex aceita os três.

export type LocalNoStorage = { bucket: string; path: string };

const PADRAO = /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/;

export function localDaUrl(url: string | null | undefined): LocalNoStorage | null {
  if (!url) return null;
  try {
    // Tira ?token=… e ?width=…: fazem parte do pedido, não do caminho.
    const semQuery = url.split("?")[0];
    const m = semQuery.match(PADRAO);
    if (!m) return null;
    // O caminho vem percent-encoded na URL; o Storage espera ele cru.
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

/** Agrupa vários arquivos por bucket, para apagar em uma chamada por bucket. */
export function agrupaPorBucket(urls: (string | null | undefined)[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const u of urls) {
    const local = localDaUrl(u);
    if (!local) continue;
    const lista = mapa.get(local.bucket) ?? [];
    lista.push(local.path);
    mapa.set(local.bucket, lista);
  }
  return mapa;
}
