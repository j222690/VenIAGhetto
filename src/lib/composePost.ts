// composePost — monta as imagens dos posts de DIVULGAÇÃO DO APP (tela
// /divulgar): story, feed e os slides de um carrossel.
//
// Tudo no canvas do navegador, sem IA. O par antes/depois já existe no banco
// (a geração guarda a foto de origem), então recriá-lo com o Gemini seria
// pagar por uma imagem que já temos — e que nem seria prova, por não ter saído
// do produto.
//
// A ARTE SEGUE A IDENTIDADE DO APP (ver THEME.md): fundo grafite-noturno,
// acento neon rosa→roxo, e a marca em Fraunces com o "Ai" no acento — a mesma
// assinatura da página de vendas. Os valores estão em hexadecimal aqui, e não
// como token, porque canvas não lê CSS custom property; foram tirados do
// próprio app (getComputedStyle → oklch → sRGB) e estão anotados ao lado.

export type PostFormat = "story" | "feed" | "carrossel";

// Story 9:16. Feed e carrossel em 4:5, o retrato mais alto que o Instagram
// aceita sem cortar. Largura 1080 é o que ele entrega sem recomprimir.
const DIMENSOES: Record<PostFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
  carrossel: { w: 1080, h: 1350 },
};

// Espelho da paleta do app (src/styles.css).
const COR = {
  fundo: "#0b0d16", // --background  oklch(0.16 0.02 275)
  cartao: "#141622", // --card        oklch(0.205 0.024 278)
  texto: "#f4f5f9", // --foreground  oklch(0.97 0.006 285)
  rosa: "#ff37b6", // --neon-pink   (é o --clay/--accent no segmento padrão)
  roxo: "#b144ff", // --neon-purple (--accent-2)
  apagado: "#a4a6bb", // --muted-foreground
};

const MARCA_1 = "Vest";
const MARCA_2 = "Ai";
const SITE = "vestaiapp.com";
const DISPLAY = '"Fraunces", ui-serif, Georgia, serif';
const SANS = '"Inter", system-ui, -apple-system, sans-serif';

// A fonte da marca é a mesma do app. Sem esperar o carregamento, o canvas cai
// no serif do sistema e a assinatura sai com outro desenho.
async function fontesProntas(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`600 96px ${DISPLAY}`),
      document.fonts.load(`600 46px ${DISPLAY}`),
      document.fonts.load(`600 30px ${SANS}`),
    ]);
    await document.fonts.ready;
  } catch {
    /* sem a fonte a arte ainda sai, só com o serif do sistema */
  }
}

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
  ctx.fillStyle = COR.fundo;
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

// Pílula do rótulo: fundo escuro translúcido com borda neon, como os chips
// ativos do app.
function etiqueta(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number) {
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `600 28px ${SANS}`;
  const largura = ctx.measureText(texto).width + 48;
  const altura = 56;

  ctx.save();
  ctx.fillStyle = "rgba(11,13,22,0.72)";
  ctx.strokeStyle = COR.rosa;
  ctx.lineWidth = 2;
  ctx.shadowColor = COR.rosa;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.roundRect(x, y, largura, altura, 28);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = COR.texto;
  ctx.fillText(texto, x + 24, y + altura / 2 + 1);
}

// Assinatura: "Vest" claro + "Ai" no acento, exatamente como a marca aparece
// na página de vendas. `linhaY` é a base do texto da marca.
function assinatura(ctx: CanvasRenderingContext2D, w: number, linhaY: number, escala = 1) {
  const tam = Math.round(46 * escala);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${tam}px ${DISPLAY}`;

  const l1 = ctx.measureText(MARCA_1).width;
  const l2 = ctx.measureText(MARCA_2).width;
  const inicio = (w - (l1 + l2)) / 2;

  ctx.fillStyle = COR.texto;
  ctx.fillText(MARCA_1, inicio, linhaY);

  ctx.save();
  ctx.fillStyle = COR.rosa;
  ctx.shadowColor = COR.rosa;
  ctx.shadowBlur = 24;
  ctx.fillText(MARCA_2, inicio + l1, linhaY);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = COR.apagado;
  ctx.font = `400 ${Math.round(26 * escala)}px ${SANS}`;
  ctx.fillText(SITE, w / 2, linhaY + Math.round(42 * escala));
}

// Fio neon rosa→roxo. É o que costura as duas metades do par e o que assina a
// arte como sendo do app.
function fioNeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  vertical: boolean,
) {
  const grad = vertical
    ? ctx.createLinearGradient(x, y, x, y + h)
    : ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, COR.rosa);
  grad.addColorStop(1, COR.roxo);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.shadowColor = COR.rosa;
  ctx.shadowBlur = 22;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

const RODAPE = 150;

export interface ParParams {
  antesUrl: string;
  depoisUrl: string;
  formato: PostFormat;
  /** Frase acima do par. Só no story, que é onde sobra altura para ela. */
  titulo?: string;
}

// Desenha a frase do story centralizada, quebrando em até 3 linhas. Devolve a
// altura ocupada, para o par ser posicionado abaixo dela.
function tituloStory(ctx: CanvasRenderingContext2D, texto: string, w: number, baseY: number): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 62px ${DISPLAY}`;
  ctx.fillStyle = COR.texto;
  const limite = w - 140;
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(teste).width > limite && atual) {
      linhas.push(atual);
      atual = palavra;
    } else atual = teste;
  }
  if (atual) linhas.push(atual);
  const usadas = linhas.slice(-3);
  usadas.forEach((linha, i) => ctx.fillText(linha, w / 2, baseY - (usadas.length - 1 - i) * 74));
}

// Antes e depois LADO A LADO, na mesma imagem.
export async function composePair({
  antesUrl,
  depoisUrl,
  formato,
  titulo,
}: ParParams): Promise<string> {
  await fontesProntas();
  const [antes, depois] = await Promise.all([loadImage(antesUrl), loadImage(depoisUrl)]);
  const { canvas, ctx, w, h } = novoCanvas(formato);

  const meio = Math.round(w / 2);
  const fio = 5;

  // No 9:16 as duas metades viram tiras de 538 de largura por quase 1800 de
  // altura: um recorte tão estreito corta as laterais da pessoa. Por isso o
  // story monta o par numa FAIXA central, com respiro em cima e embaixo, em
  // vez de esticar até o topo e o rodapé.
  let topo: number;
  let alturaPaineis: number;
  if (formato === "story") {
    // O par ocupa pouco mais de um terço do 9:16 — o resto sobraria em preto.
    // Com frase, ela toma o alto e o conjunto fica centrado; sem frase, o par
    // sobe um pouco para o vazio não pesar tudo embaixo.
    alturaPaineis = Math.round((meio * 4) / 3); // cada painel em 3:4
    topo = Math.round((h - alturaPaineis) / 2 + (titulo?.trim() ? 90 : -70));
  } else {
    topo = 0;
    alturaPaineis = h - RODAPE;
  }

  if (formato === "story" && titulo?.trim()) tituloStory(ctx, titulo.trim(), w, topo - 90);

  drawCoverTop(ctx, antes, 0, topo, meio - fio / 2, alturaPaineis);
  drawCoverTop(ctx, depois, meio + fio / 2, topo, w - meio - fio / 2, alturaPaineis);
  fioNeon(ctx, meio - fio / 2, topo, fio, alturaPaineis, true);

  etiqueta(ctx, "ANTES", 36, topo + 36);
  etiqueta(ctx, "DEPOIS", meio + 36, topo + 36);

  assinatura(ctx, w, topo + alturaPaineis + 76);
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
  await fontesProntas();
  const img = await loadImage(url);
  const { canvas, ctx, w, h } = novoCanvas(formato);

  const alturaFoto = assinar ? h - RODAPE : h;
  drawCoverTop(ctx, img, 0, 0, w, alturaFoto);
  if (assinar) fioNeon(ctx, 0, alturaFoto - 4, w, 4, false);
  if (rotulo) etiqueta(ctx, rotulo, 44, 44);
  if (assinar) assinatura(ctx, w, alturaFoto + 76);

  return canvas.toDataURL("image/jpeg", 0.92);
}

// Último slide do carrossel: só marca e chamada, sem foto.
export async function composeBrandCard(formato: PostFormat, chamada: string): Promise<string> {
  await fontesProntas();
  const { canvas, ctx, w, h } = novoCanvas(formato);

  // Brilho suave atrás da marca — a mesma sensação do --shadow-glow do app,
  // que é o que separa esta arte de um cartão preto qualquer.
  const brilho = ctx.createRadialGradient(w / 2, h / 2 - 40, 0, w / 2, h / 2 - 40, w * 0.75);
  brilho.addColorStop(0, "rgba(255,55,182,0.20)");
  brilho.addColorStop(0.55, "rgba(177,68,255,0.08)");
  brilho.addColorStop(1, "rgba(11,13,22,0)");
  ctx.fillStyle = brilho;
  ctx.fillRect(0, 0, w, h);

  // Marca grande, centralizada, com o "Ai" no acento.
  const tam = 108;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `600 ${tam}px ${DISPLAY}`;
  const l1 = ctx.measureText(MARCA_1).width;
  const l2 = ctx.measureText(MARCA_2).width;
  const x0 = (w - (l1 + l2)) / 2;
  const yMarca = h / 2 - 40;

  ctx.fillStyle = COR.texto;
  ctx.fillText(MARCA_1, x0, yMarca);
  ctx.save();
  ctx.fillStyle = COR.rosa;
  ctx.shadowColor = COR.rosa;
  ctx.shadowBlur = 40;
  ctx.fillText(MARCA_2, x0 + l1, yMarca);
  ctx.restore();

  fioNeon(ctx, w / 2 - 70, yMarca + 34, 140, 4, false);

  // Quebra a chamada em linhas que caibam na largura, sem cortar palavra.
  ctx.textAlign = "center";
  ctx.font = `400 40px ${SANS}`;
  ctx.fillStyle = COR.texto;
  const limite = w - 180;
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
  linhas.forEach((linha, i) => ctx.fillText(linha, w / 2, yMarca + 118 + i * 56));

  ctx.fillStyle = COR.rosa;
  ctx.font = `600 36px ${SANS}`;
  ctx.fillText(SITE, w / 2, yMarca + 118 + linhas.length * 56 + 56);

  return canvas.toDataURL("image/jpeg", 0.92);
}
