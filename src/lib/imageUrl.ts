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
// CUIDADO com o parâmetro resize (custou um defeito em produção): com
// resize=cover e SÓ a largura, o Storage não corta a sobra — ele mantém a
// altura original e ESPREME a imagem. Uma foto 900x1600 voltava 200x1600, e a
// peça chegava achatada; com o object-cover da célula por cima, o lojista via
// só uma faixa do look (a camisa, sem a calça). O padrão aqui é "contain", que
// escala proporcionalmente; quem enquadra é o CSS.
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
   * "contain" (padrão) escala proporcionalmente, sem cortar nem deformar.
   *
   * NÃO use "cover" sem passar `height` junto. MEDIDO numa foto 900x1600 do
   * catálogo:
   *   width=200&resize=cover    → 200x1600   ← ESPREMIDA (mantém a altura!)
   *   width=200&resize=contain  → 200x356    ← proporcional, correta
   * Com "cover" e só a largura, o Storage não corta: ele achata a imagem. O
   * enquadramento é do CSS (object-cover na célula), não do servidor.
   */
  resize?: "cover" | "contain";
  /** Só com "cover": sem ela o "cover" deforma a imagem (ver acima). */
  height?: number;
  /** Força a densidade. 1 no srcset, onde quem multiplica é o navegador. */
  dpr?: number;
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

// Conjunto de larguras para o navegador escolher (srcset). Existe porque uma
// largura única não serve às duas pontas: a que fica boa no notebook pesa à
// toa no celular, e a que serve ao celular chega BORRADA no notebook — foi o
// que aconteceu no Álbum, com miniatura de 200px num cartão de ~350px.
//
// Use junto de `sizes`, dizendo quanto o cartão ocupa em cada largura de tela.
export function thumbSrcSet(
  url: string | undefined | null,
  larguras: number[],
  quality?: number,
): string | undefined {
  if (!url) return undefined;
  const partes = larguras
    .map((w) => {
      const u = thumbUrl(url, { width: w, quality, dpr: 1 });
      return u ? `${u} ${w}w` : "";
    })
    .filter(Boolean);
  return partes.length ? partes.join(", ") : undefined;
}

// Larguras que as grades pedem de fato (ver o srcset do Álbum). Aquecer
// exatamente estas evita calcular transformação que ninguém vai usar.
const LARGURAS_QUENTES = [400, 600];

// Manda o Storage CALCULAR as miniaturas agora, para elas já estarem prontas
// quando o lojista abrir o álbum.
//
// MEDIDO numa imagem recém-gerada: a primeira miniatura leva de 1,2s a 1,5s,
// porque a transformação é calculada sob demanda; a segunda vez leva 60ms. O
// arquivo original leva 200ms — ou seja, para uma imagem nova a miniatura
// chega DEPOIS do original. Era isso que fazia as imagens recentes
// "travarem": as antigas já tinham cache, as novas pagavam o cálculo na
// frente do lojista.
//
// Dispara e esquece: falhar aqui não é problema, só significa que a primeira
// visita paga o que pagava antes.
export function prewarmThumb(url: string | undefined | null): void {
  if (!url || typeof fetch !== "function") return;
  for (const width of LARGURAS_QUENTES) {
    const alvo = thumbUrl(url, { width, dpr: 1 });
    if (alvo) void fetch(alvo, { mode: "no-cors", cache: "force-cache" }).catch(() => {});
  }
}

export function thumbUrl(url: string | undefined | null, opts: ThumbOptions): string | undefined {
  if (!url) return undefined;
  if (!url.includes(OBJECT_SEGMENT)) return url;

  // Densidade de tela: num display 2x/3x, pedir a largura CSS deixa a
  // miniatura borrada. 2x cobre a maioria dos celulares sem explodir o peso
  // (o custo cresce com a área, então limitamos em 2x mesmo em telas 3x).
  const dpr =
    opts.dpr ?? (typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1);
  const width = Math.round(opts.width * dpr);

  const params = new URLSearchParams({
    width: String(width),
    quality: String(opts.quality ?? 70),
    resize: opts.resize ?? "contain",
  });
  if (opts.height) params.set("height", String(Math.round(opts.height * dpr)));
  return url.replace(OBJECT_SEGMENT, RENDER_SEGMENT) + "?" + params.toString();
}
