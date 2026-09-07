// composePost — monta as imagens dos posts de DIVULGAÇÃO DO APP (tela
// /divulgar): story, feed e os slides de um carrossel.
//
// Tudo no canvas do navegador, sem IA. O par antes/depois já existe no banco
// (a geração guarda a foto de origem), então recriá-lo com o Gemini seria
// pagar por uma imagem que já temos — e que nem seria prova, por não ter saído
// do produto.
//
// O MOLDE veio de referências que o Victor escolheu (perfil @metakosmoslab).
// Lendo os cinco slides, a linguagem é:
//   • PRETO PURO. Sem cartão, sem moldura, sem gradiente decorativo.
//   • TEXTO EMBAIXO nas fotos, não em cima. Sobre a foto entra um véu escuro
//     que só existe onde o texto passa.
//   • MANCHETE EM CAIXA MISTA, pesada e condensada, com UMA palavra em
//     MAIÚSCULA, itálica e magenta. É o único acento da arte — e o que faz o
//     olho parar.
//   • CHAPÉU: uma linha pequena e cinza acima da manchete, quando a frase
//     precisa de contexto ("Sua cliente olha a foto do catálogo e pensa:").
//   • O carrossel abre com um slide SÓ TEXTO (o gancho) e fecha com outro só
//     texto (a chamada), com botão em pílula branca.
//   • Sem contador de slide, sem rodapé com o site em toda arte. A referência
//     não tem, e cada elemento a mais rouba peso da manchete.
//
// A versão anterior tinha selo redondo, fio neon e rodapé em todos os slides.
// Saiu tudo: era desenho meu, não a referência escolhida.

export type PostFormat = "story" | "feed" | "carrossel";

const DIMENSOES: Record<PostFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
  carrossel: { w: 1080, h: 1350 },
};

// A arte é desenhada em 4:5. No story ela é centralizada no 9:16, e a sobra
// vira zona segura para a interface do Instagram (perfil no topo, resposta no
// rodapé) — sem isso o texto fica debaixo dos controles dele.
const CARTAO = { w: 1080, h: 1350 };
const STORY_TOPO = 150;
const STORY_RODAPE = 260;

const COR = {
  fundo: "#0a0a0c",
  texto: "#ffffff",
  // Magenta da referência, que é praticamente o --neon-pink do app.
  acento: "#ff2fb4",
  chapeu: "rgba(255,255,255,0.72)",
  sub: "rgba(255,255,255,0.55)",
};

// Anton: caixa alta pesada e condensada, o desenho da manchete da referência.
// Não é fonte do app (o app usa Fraunces/Inter), então é carregada só aqui,
// quando um post é montado.
const TITULO_FONT = '"Anton", "Arial Narrow", Impact, sans-serif';
const SANS = '"Inter", system-ui, -apple-system, sans-serif';
const ANTON_CSS = "https://fonts.googleapis.com/css2?family=Anton&display=swap";

// Devolve só quando a folha de estilo terminou de carregar. Pedir a fonte
// antes disso falha calado e a manchete sai na fonte de reserva.
function garanteAnton(): Promise<void> {
  const existente = document.querySelector<HTMLLinkElement>(`link[href="${ANTON_CSS}"]`);
  if (existente?.dataset.pronto === "1") return Promise.resolve();

  const link = existente ?? document.createElement("link");
  if (!existente) {
    link.rel = "stylesheet";
    link.href = ANTON_CSS;
    document.head.appendChild(link);
  }
  return new Promise((resolve) => {
    const pronto = () => {
      link.dataset.pronto = "1";
      resolve();
    };
    if ((link.sheet as CSSStyleSheet | null) !== null) return pronto();
    link.addEventListener("load", pronto, { once: true });
    link.addEventListener("error", () => resolve(), { once: true });
    // Teto de 3s: sem a fonte a arte ainda sai, e travar a montagem seria pior.
    setTimeout(resolve, 3000);
  });
}

async function fontesProntas(): Promise<void> {
  await garanteAnton();
  try {
    // Nome da família SOZINHO: com a pilha de reserva o navegador se contenta
    // com a primeira fonte que já tem e nunca busca a Anton.
    await Promise.all([
      document.fonts.load('400 96px "Anton"'),
      document.fonts.load('400 34px "Inter"'),
      document.fonts.load('600 40px "Inter"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* a arte ainda sai, só com a fonte de reserva */
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

  const alturaCartao = formato === "story" ? h - STORY_TOPO - STORY_RODAPE : CARTAO.h;
  const topo = formato === "story" ? STORY_TOPO : 0;
  return { canvas, ctx, w, h, topo, alturaCartao };
}

// "cover": preenche a área cortando o excesso, sem distorcer.
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  /** 0 = topo (foto de pessoa, rosto em cima), 0.5 = centro. */
  ancora = 0,
) {
  const escala = Math.max(w / img.width, h / img.height);
  const sw = w / escala;
  const sh = h / escala;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * ancora, sw, sh, x, y, w, h);
}

// ---------------------------------------------------------------------------
// Manchete
//
// A palavra destacada é marcada com *asteriscos* no texto: "A foto do seu
// catálogo *mente*". Uma marca no próprio texto, em vez de um segundo campo,
// porque o destaque pertence à frase — separá-los faria escrever a frase duas
// vezes e deixaria os dois campos saírem de sincronia.
// ---------------------------------------------------------------------------

interface Pedaco {
  texto: string;
  acento: boolean;
}

function separaDestaque(frase: string): Pedaco[] {
  const partes: Pedaco[] = [];
  for (const bruto of frase.split(/(\*[^*]+\*)/g)) {
    if (!bruto) continue;
    const acento = bruto.startsWith("*") && bruto.endsWith("*") && bruto.length > 2;
    const texto = acento ? bruto.slice(1, -1).toUpperCase() : bruto;
    for (const palavra of texto.split(/(\s+)/)) {
      if (palavra) partes.push({ texto: palavra, acento });
    }
  }
  return partes;
}

const OBLIQUO = -0.18; // inclinação do destaque: a Anton não tem itálico real

function fonteDe(tam: number): string {
  return `400 ${tam}px ${TITULO_FONT}`;
}

function largura(ctx: CanvasRenderingContext2D, p: Pedaco, tam: number): number {
  ctx.font = fonteDe(tam);
  return ctx.measureText(p.texto).width;
}

function quebra(
  ctx: CanvasRenderingContext2D,
  pedacos: Pedaco[],
  tam: number,
  limite: number,
): Pedaco[][] {
  const linhas: Pedaco[][] = [];
  let atual: Pedaco[] = [];
  let larguraAtual = 0;
  for (const p of pedacos) {
    const l = largura(ctx, p, tam);
    const soEspaco = p.texto.trim() === "";
    if (larguraAtual + l > limite && atual.length && !soEspaco) {
      linhas.push(atual);
      atual = [];
      larguraAtual = 0;
    }
    if (soEspaco && !atual.length) continue; // não começa linha com espaço
    atual.push(p);
    larguraAtual += l;
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}

function desenhaLinha(
  ctx: CanvasRenderingContext2D,
  linha: Pedaco[],
  tam: number,
  centroX: number,
  y: number,
) {
  const total = linha.reduce((s, p) => s + largura(ctx, p, tam), 0);
  let x = centroX - total / 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const p of linha) {
    const l = largura(ctx, p, tam);
    ctx.font = fonteDe(tam);
    if (p.acento) {
      // Inclina só o pedaço destacado, girando em torno da própria base.
      ctx.save();
      ctx.translate(x, y);
      ctx.transform(1, 0, OBLIQUO, 1, 0, 0);
      ctx.fillStyle = COR.acento;
      ctx.fillText(p.texto, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = COR.texto;
      ctx.fillText(p.texto, x, y);
    }
    x += l;
  }
}

/** Desenha a manchete centrada no eixo X. Devolve a altura ocupada. */
function manchete(
  ctx: CanvasRenderingContext2D,
  frase: string,
  centroX: number,
  topoY: number,
  larguraMax: number,
  alturaMax: number,
  tamMax = 96,
): number {
  const pedacos = separaDestaque(frase.trim());
  for (let tam = tamMax; tam >= 44; tam -= 4) {
    const linhas = quebra(ctx, pedacos, tam, larguraMax);
    const entrelinha = Math.round(tam * 1.02);
    const altura = linhas.length * entrelinha;
    if (altura > alturaMax && tam > 44) continue;
    linhas.forEach((linha, i) =>
      desenhaLinha(ctx, linha, tam, centroX, topoY + (i + 0.82) * entrelinha),
    );
    return altura;
  }
  return 0;
}

/** Linha pequena acima da manchete. Devolve a altura ocupada. */
function chapeu(
  ctx: CanvasRenderingContext2D,
  texto: string,
  centroX: number,
  baseY: number,
  larguraMax: number,
): number {
  const tam = 34;
  ctx.font = `400 ${tam}px ${SANS}`;
  ctx.fillStyle = COR.chapeu;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.trim().split(" ")) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(teste).width > larguraMax && atual) {
      linhas.push(atual);
      atual = palavra;
    } else atual = teste;
  }
  if (atual) linhas.push(atual);
  const entrelinha = Math.round(tam * 1.35);
  linhas.forEach((l, i) => ctx.fillText(l, centroX, baseY - (linhas.length - 1 - i) * entrelinha));
  return linhas.length * entrelinha;
}

// Véu por baixo do texto: escuro na base, transparente no meio da foto.
function veuInferior(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  altura: number,
) {
  const g = ctx.createLinearGradient(0, baseY - altura, 0, baseY);
  g.addColorStop(0, "rgba(10,10,12,0)");
  g.addColorStop(0.45, "rgba(10,10,12,0.75)");
  g.addColorStop(1, "rgba(10,10,12,0.97)");
  ctx.fillStyle = g;
  ctx.fillRect(x, baseY - altura, w, altura);
}

const MARGEM = 78;
// Respiro maior embaixo das fotos: com 78 a última linha encostava na borda.
const MARGEM_BASE = 120;

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

// Altura que a manchete vai ocupar, medida antes de pintar. Sem isto não dá
// para centralizar o bloco: o texto saía de um ponto fixo e ficava sempre
// acima do centro.
function mediaManchete(frase: string, larguraMax: number, tamMax: number) {
  const ctx = document.createElement("canvas").getContext("2d")!;
  const pedacos = separaDestaque(frase.trim());
  for (let tam = tamMax; tam >= 44; tam -= 4) {
    const linhas = quebra(ctx, pedacos, tam, larguraMax);
    const altura = linhas.length * Math.round(tam * 1.02);
    if (linhas.length <= 4 || tam === 44) return { tam, altura };
  }
  return { tam: 44, altura: 0 };
}

export interface TextoParams {
  formato: PostFormat;
  /** Manchete. Marque a palavra do destaque com *asteriscos*. */
  titulo: string;
  /** Linha pequena acima da manchete. */
  chapeu?: string;
}

/** Slide SÓ TEXTO — o gancho que abre o carrossel. */
export async function composeHook({
  formato,
  titulo,
  chapeu: linha,
}: TextoParams): Promise<string> {
  await fontesProntas();
  const { canvas, ctx, w, topo, alturaCartao } = novoCanvas(formato);
  const centroY = topo + alturaCartao / 2;
  const larguraMax = w - MARGEM * 2;

  const { tam, altura } = mediaManchete(titulo, larguraMax, 104);
  const alturaChapeu = linha?.trim() ? 62 : 0;
  const topoBloco = centroY - (altura + alturaChapeu) / 2;

  if (linha?.trim()) chapeu(ctx, linha, w / 2, topoBloco - 18, larguraMax);
  manchete(ctx, titulo, w / 2, topoBloco, larguraMax, alturaCartao * 0.6, tam);

  return canvas.toDataURL("image/jpeg", 0.92);
}

export interface FotoParams extends TextoParams {
  url: string;
  /** 0 = topo (foto de cliente), 0.5 = centro (anúncio criado do zero). */
  ancora?: number;
}

/** Foto ocupando o quadro, com o texto embaixo. */
export async function composeFoto({
  url,
  formato,
  titulo,
  chapeu: linha,
  ancora = 0,
}: FotoParams): Promise<string> {
  await fontesProntas();
  const img = await loadImage(url);
  const { canvas, ctx, w, topo, alturaCartao } = novoCanvas(formato);

  drawCover(ctx, img, 0, topo, w, alturaCartao, ancora);

  const base = topo + alturaCartao - MARGEM_BASE;
  const larguraMax = w - MARGEM * 2;
  const { tam, altura: alturaTitulo } = mediaManchete(titulo, larguraMax, 84);
  const alturaChapeu = linha?.trim() ? 62 : 0;
  veuInferior(ctx, 0, topo + alturaCartao, w, alturaTitulo + alturaChapeu + MARGEM_BASE * 2.2);

  const topoTitulo = base - alturaTitulo;
  if (linha?.trim()) chapeu(ctx, linha, w / 2, topoTitulo - 26, larguraMax);
  manchete(ctx, titulo, w / 2, topoTitulo, larguraMax, alturaCartao * 0.45, tam);

  return canvas.toDataURL("image/jpeg", 0.92);
}

export interface CtaParams extends TextoParams {
  /** Texto do botão em pílula. */
  botao: string;
  /** Linha pequena embaixo do botão. */
  rodape?: string;
}

/** Slide final: chamada + botão em pílula branca. */
export async function composeCta({ formato, titulo, botao, rodape }: CtaParams): Promise<string> {
  await fontesProntas();
  const { canvas, ctx, w, topo, alturaCartao } = novoCanvas(formato);
  const centroY = topo + alturaCartao / 2;
  const larguraMax = w - MARGEM * 2;

  // Altura do conjunto (manchete + pílula + rodapé) para centralizar tudo.
  const medida = mediaManchete(titulo, larguraMax, 96);
  const topoBloco = centroY - (medida.altura + 70 + 108 + (rodape?.trim() ? 72 : 0)) / 2;
  const alturaTitulo = manchete(ctx, titulo, w / 2, topoBloco, larguraMax, 320, medida.tam);

  // Pílula branca, como na referência: texto escuro e um círculo com a seta.
  const yPilula = topoBloco + alturaTitulo + 70;
  ctx.font = `600 40px ${SANS}`;
  const larguraTexto = ctx.measureText(botao).width;
  const alturaPilula = 108;
  const raioCirculo = 34;
  const larguraPilula = larguraTexto + raioCirculo * 2 + 130;
  const xPilula = (w - larguraPilula) / 2;

  ctx.fillStyle = "#f7f5f2";
  ctx.beginPath();
  ctx.roundRect(xPilula, yPilula, larguraPilula, alturaPilula, alturaPilula / 2);
  ctx.fill();

  ctx.fillStyle = "#111114";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(botao, xPilula + 46, yPilula + alturaPilula / 2 + 2);

  const cx = xPilula + larguraPilula - 46 - raioCirculo;
  const cy = yPilula + alturaPilula / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, raioCirculo, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#f7f5f2";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy);
  ctx.lineTo(cx + 13, cy);
  ctx.moveTo(cx + 4, cy - 9);
  ctx.lineTo(cx + 13, cy);
  ctx.lineTo(cx + 4, cy + 9);
  ctx.stroke();

  if (rodape?.trim()) {
    ctx.font = `400 32px ${SANS}`;
    ctx.fillStyle = COR.sub;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(rodape.trim(), w / 2, yPilula + alturaPilula + 72);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

export interface ParParams extends TextoParams {
  antesUrl: string;
  depoisUrl: string;
}

/** Antes e depois lado a lado, com o texto embaixo. É a nossa prova. */
export async function composePair({
  antesUrl,
  depoisUrl,
  formato,
  titulo,
  chapeu: linha,
}: ParParams): Promise<string> {
  await fontesProntas();
  const [antes, depois] = await Promise.all([loadImage(antesUrl), loadImage(depoisUrl)]);
  const { canvas, ctx, w, topo, alturaCartao } = novoCanvas(formato);

  const meio = Math.round(w / 2);
  drawCover(ctx, antes, 0, topo, meio, alturaCartao);
  drawCover(ctx, depois, meio, topo, w - meio, alturaCartao);

  // Costura fina entre as duas: sem ela as fotos se confundem numa só.
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(meio - 1, topo, 2, alturaCartao);

  // Etiquetas discretas no alto, para o par se explicar sozinho.
  ctx.font = `600 26px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [rotulo, cx] of [
    ["ANTES", meio / 2],
    ["DEPOIS", meio + meio / 2],
  ] as [string, number][]) {
    const larguraRot = ctx.measureText(rotulo).width + 40;
    ctx.fillStyle = "rgba(10,10,12,0.72)";
    ctx.beginPath();
    ctx.roundRect(cx - larguraRot / 2, topo + 34, larguraRot, 48, 24);
    ctx.fill();
    ctx.fillStyle = COR.texto;
    ctx.fillText(rotulo, cx, topo + 59);
  }

  const base = topo + alturaCartao - MARGEM_BASE;
  const larguraMax = w - MARGEM * 2;
  const { tam, altura: alturaTitulo } = mediaManchete(titulo, larguraMax, 84);
  veuInferior(ctx, 0, topo + alturaCartao, w, alturaTitulo + (linha ? 62 : 0) + MARGEM_BASE * 2.2);

  const topoTitulo = base - alturaTitulo;
  if (linha?.trim()) chapeu(ctx, linha, w / 2, topoTitulo - 26, larguraMax);
  manchete(ctx, titulo, w / 2, topoTitulo, larguraMax, alturaCartao * 0.45, tam);

  return canvas.toDataURL("image/jpeg", 0.92);
}
