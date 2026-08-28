// Miniaturas servidas pelo próprio Storage do Supabase.
//
// PROBLEMA REAL MEDIDO: o app sempre usou a URL do arquivo ORIGINAL
// (StorageService.getPublicUrl → /object/public/...), inclusive onde a imagem
// aparece como miniatura de ~100px. As fotos de catálogo são 900x1600 e pesam
// de 100 a 735 KB cada — numa grade de 20 peças, isso são vários megabytes
// baixados só pra desenhar 20 quadradinhos. Era por isso que as fotos de
// cliente, álbum e catálogo demoravam pra aparecer.
//
// O Supabase serve a mesma imagem redimensionada trocando /object/ por
// /render/image/ e passando width/quality. Medido neste projeto:
//   original            487.045 bytes
//   ?width=200&quality=70   3.777 bytes   (129x menor)
//
// Só mexe em URL pública do Storage DESTE projeto: qualquer outra coisa
// (arquivo local em /public, data: URL, URL externa, URL já transformada)
// volta intacta, então usar isso nunca quebra uma imagem.
const OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

export interface ThumbOptions {
  /** Largura alvo em CSS px. Passe o tamanho de exibição, não o do arquivo. */
  width: number;
  /** 20–100. Padrão 70: em miniatura a diferença pra 100 não é perceptível. */
  quality?: number;
  /**
   * "cover" (padrão) preenche a área cortando a sobra — certo para grades
   * quadradas. "contain" cabe inteira, sem cortar — use quando a peça/pessoa
   * não pode ser cortada.
   */
  resize?: "cover" | "contain";
}

// Imagens de ENTRADA da geração (foto do cliente, peça, referência de
// cenário). Não é miniatura: é o material que a IA usa pra reproduzir a peça,
// então a régua aqui é fidelidade, não economia.
//
// MEDIDO: o fluxo de 1 peça mandava os arquivos ORIGINAIS (peça de catálogo
// 900x1600, até 735 KB). A saída do modelo é 1K, então qualquer coisa acima
// de ~1280px de largura é detalhe que ele nem consegue usar — só vira token de
// entrada e tempo de resposta. Uma geração de 1 peça levou 71,8s e outra
// falhou por isso. Na mesma imagem: 475 KB no original, 37 KB a 1024px/q80.
//
// 1280px e qualidade 85 (não 1024/70) de propósito: as cláusulas de fidelidade
// exigem reproduzir fecho, botão, braguilha e costura na posição exata, e é
// justamente esse detalhe fino que morre primeiro quando se comprime demais.
export function genUrl(url: string): string {
  return thumbUrl(url, { width: 1280, quality: 85, resize: "contain" }) ?? url;
}

export function thumbUrl(url: string | undefined | null, opts: ThumbOptions): string | undefined {
  if (!url) return undefined;
  if (!url.includes(OBJECT_SEGMENT)) return url;

  // Densidade de tela: num display 2x/3x, pedir a largura CSS deixa a
  // miniatura borrada. 2x cobre a maioria dos celulares sem explodir o peso
  // (o custo cresce com a área, então limitamos em 2x mesmo em telas 3x).
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const width = Math.round(opts.width * dpr);

  const params = new URLSearchParams({
    width: String(width),
    quality: String(opts.quality ?? 70),
    resize: opts.resize ?? "cover",
  });
  return url.replace(OBJECT_SEGMENT, RENDER_SEGMENT) + "?" + params.toString();
}
