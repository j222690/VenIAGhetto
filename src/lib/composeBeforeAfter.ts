// composeBeforeAfter — monta a imagem de um post de DIVULGAÇÃO DO APP: a foto
// que o lojista mandou de um lado, o resultado do Provador do outro, com as
// legendas "ANTES"/"DEPOIS" e a marca embaixo.
//
// Tudo no canvas do navegador, sem IA: o par já existe no banco (a geração
// guarda a foto de origem em inputs.clientPhotoUrl), então recriá-lo com o
// Gemini seria pagar por uma imagem que já temos — e ainda por cima uma que
// não é prova de nada, porque não teria saído do produto de verdade.
//
// Usado só pela tela /divulgar (interna dos donos do app).

export type PostFormat = "feed" | "story";

// Instagram: feed em 4:5 (o retrato mais alto que o feed aceita sem cortar) e
// story em 9:16. Largura 1080 é o que o Instagram entrega sem recomprimir.
const DIMENSOES: Record<PostFormat, { w: number; h: number }> = {
  feed: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

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

function drawEtiqueta(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number) {
  ctx.font = "600 30px system-ui, -apple-system, Segoe UI, sans-serif";
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

export interface BeforeAfterParams {
  antesUrl: string;
  depoisUrl: string;
  formato: PostFormat;
  /** Marca no rodapé. Vazio esconde a faixa inteira. */
  marca?: string;
  /** Chamada curta abaixo da marca (ex.: o site). */
  chamada?: string;
}

// Devolve um data URL (image/jpeg) pronto pra baixar ou compartilhar.
export async function composeBeforeAfter(params: BeforeAfterParams): Promise<string> {
  const { antesUrl, depoisUrl, formato, marca = "Vest Ai", chamada = "vestaiapp.com" } = params;
  const { w, h } = DIMENSOES[formato];

  const [antes, depois] = await Promise.all([loadImage(antesUrl), loadImage(depoisUrl)]);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  ctx.fillStyle = "#0f0e0d";
  ctx.fillRect(0, 0, w, h);

  const rodape = marca ? 132 : 0;
  const alturaPaineis = h - rodape;
  const meio = Math.round(w / 2);
  const divisoria = 4;

  drawCoverTop(ctx, antes, 0, 0, meio - divisoria / 2, alturaPaineis);
  drawCoverTop(ctx, depois, meio + divisoria / 2, 0, w - meio - divisoria / 2, alturaPaineis);

  // Risco branco no meio: é o que faz o olho ler as duas metades como um par,
  // e não como duas fotos soltas.
  ctx.fillStyle = "#fff";
  ctx.fillRect(meio - divisoria / 2, 0, divisoria, alturaPaineis);

  drawEtiqueta(ctx, "ANTES", 32, 32);
  drawEtiqueta(ctx, "DEPOIS", meio + 32, 32);

  if (marca) {
    ctx.fillStyle = "#0f0e0d";
    ctx.fillRect(0, alturaPaineis, w, rodape);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "600 46px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(marca, w / 2, alturaPaineis + 52);
    if (chamada) {
      ctx.fillStyle = "rgba(255,255,255,0.68)";
      ctx.font = "400 28px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(chamada, w / 2, alturaPaineis + 96);
    }
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}
