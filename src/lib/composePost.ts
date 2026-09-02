// composePost — monta as imagens dos posts de DIVULGAÇÃO DO APP (tela
// /divulgar): story, feed e os slides de um carrossel.
//
// Tudo no canvas do navegador, sem IA. O par antes/depois já existe no banco
// (a geração guarda a foto de origem), então recriá-lo com o Gemini seria
// pagar por uma imagem que já temos — e que nem seria prova, por não ter saído
// do produto.

export type PostFormat = "story" | "feed" | "carrossel";

// Story 9:16. Feed e carrossel em 4:5, o retrato mais alto que o Instagram
// aceita sem cortar. Largura 1080 é o que ele entrega sem recomprimir.
const DIMENSOES: Record<PostFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
  carrossel: { w: 1080, h: 1350 },
};

const FUNDO = "#0f0e0d";
const MARCA = "Vest Ai";
const SITE = "vestaiapp.com";
const FONTE = "system-ui, -apple-system, Segoe UI, sans-serif";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Sem isto o canvas fica "tainted" e toDataURL lança — as imagens vêm do
    // Storage, que é outra origem.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
    img.src = url;
  });
}

function novoCanvas(formato: PostFormat) {
  const { w, h } = DIMENSOES[formato];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx, w, h };
}

// "cover": preenche o painel cortando o excesso, sem distorcer. Ancorado no
// TOPO (não no centro) porque em foto de pessoa o que não pode sumir é o
// rosto — o mesmo motivo do object-position: top nas miniaturas do álbum.
function drawCoverTop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const escala = Math.max(w / img.width, h / img.height);
  const sw = w / escala;
  const sh = h / escala;
  ctx.drawImage(img, (img.width - sw) / 2, 0, sw, sh, x, y, w, h);
}

function etiqueta(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number) {
  ctx.textAlign = "left";
  ctx.font = `600 30px ${FONTE}`;
  const largura = ctx.measureText(texto).width + 44;
  const altura = 54;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.beginPath();
  ctx.roundRect(x, y, largura, altura, 27);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, x + 22, y + altura / 2 + 1);
}

// Assinatura embaixo: marca grande, site menor. `centroY` é a linha da marca.
function assinatura(ctx: CanvasRenderingContext2D, w: number, centroY: number) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.font = `600 46px ${FONTE}`;
  ctx.fillText(MARCA, w / 2, centroY);
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = `400 28px ${FONTE}`;
  ctx.fillText(SITE, w / 2, centroY + 44);
}

const RODAPE = 132;

export interface ParParams {
  antesUrl: string;
  depoisUrl: string;
  formato: PostFormat;
}

// Antes e depois LADO A LADO, na mesma imagem.
export async function composePair({ antesUrl, depoisUrl, formato }: ParParams): Promise<string> {
  const [antes, depois] = await Promise.all([loadImage(antesUrl), loadImage(depoisUrl)]);
  const { canvas, ctx, w, h } = novoCanvas(formato);

  const meio = Math.round(w / 2);
  const divisoria = 4;

  // No 9:16 as duas metades viram tiras de 538 de largura por quase 1800 de
  // altura: um recorte tão estreito corta as laterais da pessoa. Por isso o
  // story monta o par numa FAIXA central, com respiro em cima e embaixo, em
  // vez de esticar até o topo e o rodapé.
  let topo: number;
  let alturaPaineis: number;
  if (formato === "story") {
    alturaPaineis = Math.round((meio * 4) / 3); // cada painel em 3:4
    topo = Math.round((h - alturaPaineis) / 2 - 60);
  } else {
    topo = 0;
    alturaPaineis = h - RODAPE;
  }

  drawCoverTop(ctx, antes, 0, topo, meio - divisoria / 2, alturaPaineis);
  drawCoverTop(ctx, depois, meio + divisoria / 2, topo, w - meio - divisoria / 2, alturaPaineis);

  // Risco branco no meio: é o que faz o olho ler as duas metades como um par,
  // e não como duas fotos soltas.
  ctx.fillStyle = "#fff";
  ctx.fillRect(meio - divisoria / 2, topo, divisoria, alturaPaineis);

  etiqueta(ctx, "ANTES", 32, topo + 32);
  etiqueta(ctx, "DEPOIS", meio + 32, topo + 32);

  assinatura(ctx, w, topo + alturaPaineis + 64);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export interface SlideParams {
  url: string;
  formato: PostFormat;
  /** Pílula no canto (ex.: "ANTES"). Vazio esconde. */
  rotulo?: string;
  /** Assinatura no rodapé. Desligue nos slides do meio de um carrossel. */
  assinar?: boolean;
}

// Uma foto só, ocupando o slide inteiro.
export async function composeSlide({
  url,
  formato,
  rotulo,
  assinar = true,
}: SlideParams): Promise<string> {
  const img = await loadImage(url);
  const { canvas, ctx, w, h } = novoCanvas(formato);

  const alturaFoto = assinar ? h - RODAPE : h;
  drawCoverTop(ctx, img, 0, 0, w, alturaFoto);
  if (rotulo) etiqueta(ctx, rotulo, 40, 40);
  if (assinar) assinatura(ctx, w, alturaFoto + 64);

  return canvas.toDataURL("image/jpeg", 0.92);
}

// Último slide do carrossel: só marca e chamada, sem foto.
export function composeBrandCard(formato: PostFormat, chamada: string): string {
  const { canvas, ctx, w, h } = novoCanvas(formato);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = `600 86px ${FONTE}`;
  ctx.fillText(MARCA, w / 2, h / 2 - 60);

  // Quebra a chamada em linhas que caibam na largura, sem cortar palavra.
  ctx.font = `400 40px ${FONTE}`;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  const limite = w - 160;
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of chamada.split(" ")) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(teste).width > limite && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = teste;
    }
  }
  if (atual) linhas.push(atual);
  linhas.forEach((linha, i) => ctx.fillText(linha, w / 2, h / 2 + 20 + i * 54));

  ctx.fillStyle = "#fff";
  ctx.font = `600 38px ${FONTE}`;
  ctx.fillText(SITE, w / 2, h / 2 + 40 + linhas.length * 54 + 40);

  return canvas.toDataURL("image/jpeg", 0.92);
}
