// Recomprime imagem antes de guardar no Storage.
//
// POR QUE
// O que o Gemini devolve e o que o import-catalog baixa iam para o disco
// exatamente como vieram. Medido em 24 arquivos reais do bucket `generated`:
// PNG de 1,95 MB em média, JPEG de qualidade ~98 com 0,69 MB. Regravando em
// JPEG 82 — sem reduzir um pixel, porque as imagens já saem com 768–1150px —
// o mesmo conjunto caiu 88%, e num recorte a 100% em cima do tecido as duas
// versões são indistinguíveis.
//
// A REGRA É FALHAR PARA O LADO SEGURO
// Se a imagem não decodificar (WebP, por exemplo, que o ImageScript não lê),
// devolve o original intacto. Perder a foto do cliente para economizar disco
// seria uma troca péssima.
// A biblioteca entra por import DINÂMICO, de propósito.
//
// Um `import` no topo roda quando a função sobe. Se o deno.land estiver fora
// do ar ou a versão sumir, a função inteira deixa de bootar — e generate-image
// é o caminho que gera receita. Carregando sob demanda, uma falha aqui custa a
// compressão daquela imagem, não a geração.
let libPromise: Promise<typeof import("https://deno.land/x/imagescript@1.3.0/mod.ts")> | null = null;
function lib() {
  libPromise ??= import("https://deno.land/x/imagescript@1.3.0/mod.ts");
  return libPromise;
}

// O mesmo teto do upload feito pelo lojista (src/services/StorageService.ts).
const LADO_MAX = 1600;
const QUALIDADE = 82;

export type Comprimida = {
  bytes: Uint8Array;
  contentType: string;
  /** Falso quando devolveu o original — útil para registrar no log. */
  recomprimida: boolean;
};

export async function comprimeImagem(
  bytes: Uint8Array,
  contentTypeOriginal: string,
): Promise<Comprimida> {
  const original: Comprimida = {
    bytes,
    contentType: contentTypeOriginal,
    recomprimida: false,
  };

  // GIF animado perde a animação ao virar JPEG, e SVG não é bitmap.
  if (/gif|svg/i.test(contentTypeOriginal)) return original;

  try {
    const { decode, Image } = await lib();
    const img = await decode(bytes);
    if (!(img instanceof Image)) return original; // GIF multi-quadro

    const maior = Math.max(img.width, img.height);
    if (maior > LADO_MAX) {
      const escala = LADO_MAX / maior;
      img.resize(Math.round(img.width * escala), Math.round(img.height * escala));
    }

    const jpeg = await img.encodeJPEG(QUALIDADE);

    // Se a recompressão não ajudou, fica com o original. Acontece com imagem
    // já pequena e muito comprimida.
    if (jpeg.byteLength >= bytes.byteLength) return original;

    return { bytes: jpeg, contentType: "image/jpeg", recomprimida: true };
  } catch (_e) {
    // Formato que não sabemos ler. Guarda como veio.
    return original;
  }
}
