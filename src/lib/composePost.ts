// composePost — monta as imagens dos posts de DIVULGAÇÃO DO APP (tela
// /divulgar): story, feed e os slides de um carrossel.
//
// Tudo no canvas do navegador, sem IA. O par antes/depois já existe no banco
// (a geração guarda a foto de origem), então recriá-lo com o Gemini seria
// pagar por uma imagem que já temos — e que nem seria prova, por não ter saído
// do produto.
//
// O MOLDE segue o que a pesquisa de capa de carrossel recomenda, e cada peça
// está aqui por um motivo:
//   • MANCHETE NO TERÇO SUPERIOR e o maior texto da arte. O feed é percorrido
//     a 3–4 posts por segundo; o que estiver embaixo não é lido antes do
//     polegar passar. (Era o erro da versão anterior: manchete no rodapé.)
//   • SELO COM NÚMERO — a lacuna de curiosidade. Número é o que o olho pega
//     primeiro, e ele promete o que a legenda vai entregar.
//   • PISTA DIRECIONAL: a seta entre as fotos e o "deslize" no rodapé.
//   • TRÊS CORES, na proporção 60-30-10: grafite de base, branco no texto,
//     neon só no acento. A versão anterior usava cinco e ficava carnavalesca.
//   • CONTRASTE: texto sobre foto sempre com véu escuro por baixo — sem ele a
//     manchete some numa foto clara.
// Fontes: panocollages.com/blog/best-practices-for-first-slide-carousel-hooks
// e imagine.art/blogs/best-carousel-hooks (consultadas em 2026-09).
//
// As CORES são as do app (ver THEME.md). Ficam em hexadecimal aqui porque
// canvas não lê CSS custom property; cada uma está anotada com o token que
// espelha, lido do próprio app.

export type PostFormat = "story" | "feed" | "carrossel";

const DIMENSOES: Record<PostFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
  carrossel: { w: 1080, h: 1350 },
};

// A arte é desenhada sempre em 4:5 — a proporção em que este molde funciona.
// No story ela é centralizada no 9:16, e a sobra em cima e embaixo vira zona
// segura para a interface do Instagram (perfil no topo, resposta no rodapé).
const CARTAO = { w: 1080, h: 1350 };

// Zonas seguras do story: o Instagram desenha o perfil no topo e a caixa de
// resposta no rodapé. Sem reservar essa faixa, a manchete e a assinatura
// ficavam debaixo da interface dele — o rodapé sumia inteiro.
const STORY_TOPO = 150;
const STORY_RODAPE = 260;

// Espelho da paleta do app (src/styles.css).
const COR = {
  fundo: "#0b0d16", // --background     oklch(0.16 0.02 275)
  texto: "#f4f5f9", // --foreground     oklch(0.97 0.006 285)
  rosa: "#ff37b6", // --neon-pink      (--clay/--accent no segmento padrão)
  roxo: "#b144ff", // --neon-purple    (--accent-2)
  azul: "#00c8ff", // --neon-blue
  apagado: "#a4a6bb", // --muted-foreground
};

const SITE = "vestaiapp.com";
// Anton: caixa alta pesada e condensada, que é o que dá peso à manchete deste
// molde. Não é fonte do app — o app usa Fraunces/Inter —, então é carregada só
// aqui, quando um post é montado, e não no carregamento de todas as telas.
const TITULO_FONT = '"Anton", "Arial Narrow", Impact, sans-serif';
const SANS = '"Inter", system-ui, -apple-system, sans-serif';
const ANTON_CSS = "https://fonts.googleapis.com/css2?family=Anton&display=swap";

// Devolve só quando a folha de estilo da fonte terminou de carregar. Pedir o
// carregamento da fonte antes disso falha calado, e a manchete sai na fonte de
// reserva — foi o que aconteceu na primeira prova.
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
    // Teto de 3s: sem a fonte a arte ainda sai, e travar a montagem seria pior.
    const pronto = () => {
      link.dataset.pronto = "1";
      resolve();
    };
    if ((link.sheet as CSSStyleSheet | null) !== null) return pronto();
    link.addEventListener("load", pronto, { once: true });
    link.addEventListener("error", () => resolve(), { once: true });
    setTimeout(resolve, 3000);
  });
}

// Sem esperar o carregamento, o canvas cai calado numa fonte do sistema e a
// arte sai com outro desenho.
async function fontesProntas(): Promise<void> {
  await garanteAnton();
  try {
    // Nome da família SOZINHO, sem a pilha de reserva: com a pilha, o
    // navegador se dá por satisfeito ao encontrar a primeira fonte que já
    // tem e nunca busca a Anton.
    await Promise.all([
      document.fonts.load('400 96px "Anton"'),
      document.fonts.load('600 34px "Inter"'),
      document.fonts.load('700 30px "Inter"'),
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

// Canvas do formato final, com a área 4:5 já posicionada dentro dele.
function novoCanvas(formato: PostFormat) {
  const { w, h } = DIMENSOES[formato];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, w, h);
  const topo = formato === "story" ? Math.round((h - CARTAO.h) / 2) : 0;
  return { canvas, ctx, w, h, topo };
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
  /** 0 = topo (foto de cliente, onde o rosto está em cima), 0.5 = centro. */
  ancora = 0,
) {
  const escala = Math.max(w / img.width, h / img.height);
  const sw = w / escala;
  const sh = h / escala;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * ancora, sw, sh, x, y, w, h);
}

function gradienteNeon(ctx: CanvasRenderingContext2D, x0: number, x1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, COR.azul);
  g.addColorStop(0.5, COR.rosa);
  g.addColorStop(1, COR.roxo);
  return g;
}

// Seta curva de uma foto para a outra: é ela que diz "isto virou aquilo".
function setaCurva(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const vao = 155;
  const p0 = { x: cx - vao, y: cy };
  const ctrl = { x: cx, y: cy + 96 };
  const p1 = { x: cx + vao, y: cy + 22 };

  ctx.save();
  ctx.strokeStyle = gradienteNeon(ctx, p0.x, p1.x);
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = COR.rosa;
  ctx.shadowBlur = 26;

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, p1.x, p1.y);
  ctx.stroke();

  // Ponta na inclinação REAL do fim da curva: a derivada da quadrática em
  // t=1 é 2*(P1 - C). Calcular à mão deixava a ponta torta.
  const ang = Math.atan2(p1.y - ctrl.y, p1.x - ctrl.x);
  const p = 38;
  const abertura = 0.62;
  ctx.beginPath();
  ctx.moveTo(p1.x - p * Math.cos(ang - abertura), p1.y - p * Math.sin(ang - abertura));
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p1.x - p * Math.cos(ang + abertura), p1.y - p * Math.sin(ang + abertura));
  ctx.stroke();
  ctx.restore();
}

// Linha fina com a marca no meio, como o crédito do post de referência.
function linhaMarca(ctx: CanvasRenderingContext2D, w: number, x: number, y: number) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 30px ${SANS}`;
  const larguraTexto = ctx.measureText(SITE).width;
  const margem = 70;
  const vao = larguraTexto / 2 + 26;

  ctx.save();
  ctx.strokeStyle = gradienteNeon(ctx, x + margem, x + w - margem);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + margem, y);
  ctx.lineTo(x + w / 2 - vao, y);
  ctx.moveTo(x + w / 2 + vao, y);
  ctx.lineTo(x + w - margem, y);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = COR.rosa;
  ctx.fillText(SITE, x + w / 2, y + 1);
}

// Manchete em caixa alta, quebrando em linhas e encolhendo se precisar caber.
function manchete(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  w: number,
  topoY: number,
  alturaDisponivel: number,
  margem = 110,
): number {
  const limite = w - margem;
  const alvo = texto.toUpperCase();

  // Começa grande: a manchete tem de ser o MAIOR texto da arte. Só encolhe
  // quando não cabe.
  for (const tam of [104, 96, 88, 80, 72, 64, 58, 52]) {
    ctx.font = `400 ${tam}px ${TITULO_FONT}`;
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of alvo.split(" ")) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(teste).width > limite && atual) {
        linhas.push(atual);
        atual = palavra;
      } else atual = teste;
    }
    if (atual) linhas.push(atual);

    const entrelinha = Math.round(tam * 1.04);
    const altura = linhas.length * entrelinha;
    if (altura > alturaDisponivel && tam > 52) continue;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COR.texto;
    linhas.forEach((linha, i) => ctx.fillText(linha, x + w / 2, topoY + i * entrelinha));
    return topoY + altura;
  }
  return topoY;
}

export interface CartaoParams {
  /** Manchete em caixa alta, no terço superior. É o que carrega o post. */
  titulo?: string;
  /** Chamada pequena no rodapé (ex.: "Deslize e veja"). */
  chamada?: string;
  /** Selo curto sobre a foto, de preferência com número: "30s", "1 foto". */
  selo?: string;
}

// Altura do bloco do cabeçalho, em fração do cartão. O terço superior é o que
// a pesquisa manda reservar para o gancho.
const BLOCO_TITULO = 0.27;
const ALTURA_RODAPE = 107;

// O texto vive num BLOCO SÓLIDO, não sobre a foto. Testei por cima com véu e a
// manchete caía no rosto da pessoa — texto sobre rosto é o erro clássico, e
// com foto de cliente variável não dá para garantir uma área limpa.

// Selo com o número. Fica sobre a foto, do lado direito, longe da manchete.
function seloNumero(ctx: CanvasRenderingContext2D, texto: string, cx: number, cy: number) {
  const r = 92;
  ctx.save();
  ctx.fillStyle = COR.rosa;
  ctx.shadowColor = COR.rosa;
  ctx.shadowBlur = 34;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Texto escuro sobre o rosa: o contraste inverte e o selo salta.
  ctx.fillStyle = COR.fundo;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let tam = 62;
  ctx.font = `400 ${tam}px ${TITULO_FONT}`;
  while (ctx.measureText(texto).width > r * 1.6 && tam > 26) {
    tam -= 4;
    ctx.font = `400 ${tam}px ${TITULO_FONT}`;
  }
  ctx.fillText(texto.toUpperCase(), cx, cy + 2);
}

// Etiqueta pequena no pé da foto (ANTES / DEPOIS). Fica embaixo, e não no
// topo, para não disputar espaço com a manchete.
function etiquetaPe(ctx: CanvasRenderingContext2D, texto: string, cx: number, baseY: number) {
  ctx.font = `700 26px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const larg = ctx.measureText(texto).width + 44;
  const alt = 50;
  ctx.save();
  ctx.fillStyle = "rgba(11,13,22,0.82)";
  ctx.beginPath();
  ctx.roundRect(cx - larg / 2, baseY - alt, larg, alt, 25);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COR.texto;
  ctx.fillText(texto.toUpperCase(), cx, baseY - alt / 2 + 1);
}

// Cabeçalho: bloco sólido no topo com a manchete. Devolve onde a foto começa.
function cabecalho(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  alturaCartao: number,
  { titulo }: CartaoParams,
): number {
  if (!titulo?.trim()) return y;

  const alturaBloco = Math.round(alturaCartao * BLOCO_TITULO);
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(x, y, w, alturaBloco);

  const alturaTexto = manchete(ctx, titulo.trim(), x, w, y + 56, alturaBloco - 96, 120) - (y + 56);
  // Centraliza o texto no bloco: sobra igual em cima e embaixo.
  const folga = Math.max(0, alturaBloco - 96 - alturaTexto);
  if (folga > 12) {
    ctx.fillStyle = COR.fundo;
    ctx.fillRect(x, y, w, alturaBloco);
    manchete(ctx, titulo.trim(), x, w, y + 56 + Math.round(folga / 2), alturaBloco - 96, 120);
  }

  return y + alturaBloco;
}

// Rodapé: fio neon, marca e a pista para deslizar. Enxuto de propósito — o
// peso da arte é a manchete, não o rodapé.
function rodape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, chamada?: string) {
  ctx.save();
  ctx.strokeStyle = gradienteNeon(ctx, x, x + w);
  ctx.lineWidth = 5;
  ctx.shadowColor = COR.rosa;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = COR.fundo;
  ctx.fillRect(x, y + 3, w, 104);

  ctx.textBaseline = "middle";
  ctx.font = `600 30px ${SANS}`;
  ctx.textAlign = "left";
  ctx.fillStyle = COR.texto;
  ctx.fillText(SITE, x + 56, y + 56);

  if (chamada?.trim()) {
    ctx.textAlign = "right";
    ctx.fillStyle = COR.rosa;
    ctx.font = `700 30px ${SANS}`;
    // Tira setas que já venham no texto: com elas saía "DESLIZE >>>  →".
    const limpo = chamada.trim().replace(/[>»→\s]+$/u, "");
    ctx.fillText(`${limpo.toUpperCase()}  →`, x + w - 56, y + 56);
  }
}

export interface ParParams extends CartaoParams {
  antesUrl: string;
  depoisUrl: string;
  formato: PostFormat;
}

// Antes e depois LADO A LADO, colados, com a seta ligando os dois.
export async function composePair({
  antesUrl,
  depoisUrl,
  formato,
  titulo,
  chamada,
  selo,
}: ParParams): Promise<string> {
  await fontesProntas();
  const [antes, depois] = await Promise.all([loadImage(antesUrl), loadImage(depoisUrl)]);
  const { canvas, ctx, w, h, topo } = novoCanvas(formato);

  // A foto ocupa TUDO: manchete e rodapé vivem sobre ela. Assim a arte não
  // gasta um terço da área em tarja preta, e a foto é o que segura o olhar.
  const alturaCartao = formato === "story" ? h - STORY_TOPO - STORY_RODAPE : CARTAO.h;
  const y = formato === "story" ? STORY_TOPO : topo;
  const meio = Math.round(w / 2);

  const fotoY = titulo?.trim() ? y + Math.round(alturaCartao * BLOCO_TITULO) : y;
  const fotoH = y + alturaCartao - ALTURA_RODAPE - fotoY;

  drawCoverTop(ctx, antes, 0, fotoY, meio, fotoH);
  drawCoverTop(ctx, depois, meio, fotoY, w - meio, fotoH);

  // Costura fina entre as duas: sem ela as fotos se confundem numa só.
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(meio - 1, fotoY, 2, fotoH);

  setaCurva(ctx, meio, fotoY + Math.round(fotoH * 0.5));
  etiquetaPe(ctx, "Antes", meio / 2, fotoY + fotoH - 34);
  etiquetaPe(ctx, "Depois", meio + meio / 2, fotoY + fotoH - 34);

  cabecalho(ctx, 0, y, w, alturaCartao, { titulo });
  // O selo cavalga a borda do bloco: metade no texto, metade na foto. É o que
  // dá profundidade e impede que ele pareça só mais um adesivo solto.
  if (selo?.trim()) seloNumero(ctx, selo.trim(), w - 148, fotoY);
  rodape(ctx, 0, y + alturaCartao - ALTURA_RODAPE, w, chamada);

  return canvas.toDataURL("image/jpeg", 0.92);
}

export interface SlideParams extends CartaoParams {
  url: string;
  formato: PostFormat;
  /** Sem texto nenhum: para os slides do meio de um carrossel. */
  semTarja?: boolean;
}

// Uma foto só, no mesmo molde.
export async function composeSlide({
  url,
  formato,
  titulo,
  chamada,
  selo,
  semTarja = false,
}: SlideParams): Promise<string> {
  await fontesProntas();
  const img = await loadImage(url);
  const { canvas, ctx, w, h, topo } = novoCanvas(formato);

  const alturaCartao = formato === "story" ? h - STORY_TOPO - STORY_RODAPE : CARTAO.h;
  const y = formato === "story" ? STORY_TOPO : topo;

  if (semTarja) {
    drawCoverTop(ctx, img, 0, y, w, alturaCartao);
  } else {
    const fotoY = titulo?.trim() ? y + Math.round(alturaCartao * BLOCO_TITULO) : y;
    // Centro, não topo: no anúncio criado do zero a cena é composta no meio
    // do quadro, e ancorar no topo cortava as pessoas pela base.
    drawCoverTop(ctx, img, 0, fotoY, w, y + alturaCartao - ALTURA_RODAPE - fotoY, 0.5);
    cabecalho(ctx, 0, y, w, alturaCartao, { titulo });
    if (selo?.trim()) seloNumero(ctx, selo.trim(), w - 148, fotoY);
    rodape(ctx, 0, y + alturaCartao - ALTURA_RODAPE, w, chamada);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

// Último slide do carrossel: só marca e chamada, sem foto.
export async function composeBrandCard(formato: PostFormat, chamada: string): Promise<string> {
  await fontesProntas();
  const { canvas, ctx, w, h, topo } = novoCanvas(formato);

  // Brilho suave ao fundo — a mesma sensação do --shadow-glow do app, que é o
  // que separa esta arte de um cartão preto qualquer.
  const cy = topo + CARTAO.h / 2;
  const brilho = ctx.createRadialGradient(w / 2, cy, 0, w / 2, cy, w * 0.8);
  brilho.addColorStop(0, "rgba(255,55,182,0.18)");
  brilho.addColorStop(0.5, "rgba(177,68,255,0.08)");
  brilho.addColorStop(1, "rgba(11,13,22,0)");
  ctx.fillStyle = brilho;
  ctx.fillRect(0, 0, w, h);

  linhaMarca(ctx, w, 0, cy - 210);
  const fim = manchete(ctx, chamada, 0, w, cy - 150, 320);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `700 34px ${SANS}`;
  ctx.fillStyle = COR.azul;
  ctx.fillText("COMECE HOJE · VESTAIAPP.COM", w / 2, fim + 46);

  return canvas.toDataURL("image/jpeg", 0.92);
}
