// composePost — monta as imagens dos posts de DIVULGAÇÃO DO APP (tela
// /divulgar): story, feed e os slides de um carrossel.
//
// Tudo no canvas do navegador, sem IA. O par antes/depois já existe no banco
// (a geração guarda a foto de origem), então recriá-lo com o Gemini seria
// pagar por uma imagem que já temos — e que nem seria prova, por não ter saído
// do produto.
//
// O MOLDE é o do post de antes/depois que funciona no Instagram: as fotos
// coladas ocupando o alto, uma seta curva ligando uma à outra, e uma tarja
// embaixo com a marca numa linha fina, a manchete em caixa alta pesada e a
// chamada para deslizar. As CORES são as do app (ver THEME.md): grafite
// noturno com o neon azul → rosa → roxo. Ficam em hexadecimal aqui porque
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
) {
  const escala = Math.max(w / img.width, h / img.height);
  const sw = w / escala;
  const sh = h / escala;
  ctx.drawImage(img, (img.width - sw) / 2, 0, sw, sh, x, y, w, h);
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
): number {
  const limite = w - 110;
  const alvo = texto.toUpperCase();

  for (const tam of [82, 76, 70, 64, 58, 52, 46]) {
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

    const entrelinha = Math.round(tam * 1.06);
    const altura = linhas.length * entrelinha;
    if (altura > alturaDisponivel && tam > 46) continue;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COR.texto;
    linhas.forEach((linha, i) => ctx.fillText(linha, x + w / 2, topoY + i * entrelinha));
    return topoY + altura;
  }
  return topoY;
}

export interface CartaoParams {
  /** Manchete em caixa alta. É o que carrega o post. */
  titulo?: string;
  /** Chamada pequena embaixo (ex.: "DESLIZE E VEJA >>>"). */
  chamada?: string;
}

// Desenha a tarja de baixo (marca + manchete + chamada) na área do cartão.
function tarja(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  { titulo, chamada }: CartaoParams,
) {
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(x, y, w, h);

  linhaMarca(ctx, w, x, y + 40);

  const temChamada = !!chamada?.trim();
  const espacoTitulo = h - 90 - (temChamada ? 80 : 30);
  const fim = titulo?.trim() ? manchete(ctx, titulo.trim(), x, w, y + 82, espacoTitulo) : y + 82;

  if (temChamada) {
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 30px ${SANS}`;
    ctx.fillStyle = COR.azul;
    ctx.fillText(chamada!.trim().toUpperCase(), x + w / 2, Math.min(fim + 34, y + h - 56));
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
}: ParParams): Promise<string> {
  await fontesProntas();
  const [antes, depois] = await Promise.all([loadImage(antesUrl), loadImage(depoisUrl)]);
  const { canvas, ctx, w, topo } = novoCanvas(formato);

  // 63% de foto: proporção do molde, e o que deixa cada metade em 540x850 —
  // retrato o bastante para a pessoa caber sem corte lateral.
  const alturaFoto = Math.round(CARTAO.h * 0.63);
  const meio = Math.round(w / 2);

  drawCoverTop(ctx, antes, 0, topo, meio, alturaFoto);
  drawCoverTop(ctx, depois, meio, topo, w - meio, alturaFoto);

  // Costura fina entre as duas: sem ela as fotos se confundem numa só.
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(meio - 1, topo, 2, alturaFoto);

  setaCurva(ctx, meio, topo + Math.round(alturaFoto * 0.45));
  tarja(ctx, 0, topo + alturaFoto, w, CARTAO.h - alturaFoto, { titulo, chamada });

  return canvas.toDataURL("image/jpeg", 0.92);
}

export interface SlideParams extends CartaoParams {
  url: string;
  formato: PostFormat;
  /** Sem tarja: para os slides do meio de um carrossel, que são só foto. */
  semTarja?: boolean;
}

// Uma foto só, no mesmo molde.
export async function composeSlide({
  url,
  formato,
  titulo,
  chamada,
  semTarja = false,
}: SlideParams): Promise<string> {
  await fontesProntas();
  const img = await loadImage(url);
  const { canvas, ctx, w, h, topo } = novoCanvas(formato);

  // Com UMA foto o story usa a altura toda: não há duas metades disputando
  // largura, então não há motivo para encolher a arte num 4:5 e deixar o topo
  // vazio. (No par isso não vale: em 9:16 cada metade viraria uma tira.)
  const alturaCartao = formato === "story" ? h : CARTAO.h;
  const y = formato === "story" ? 0 : topo;

  if (semTarja) {
    drawCoverTop(ctx, img, 0, y, w, alturaCartao);
  } else {
    const alturaFoto = Math.round(alturaCartao * (formato === "story" ? 0.75 : 0.63));
    drawCoverTop(ctx, img, 0, y, w, alturaFoto);
    tarja(ctx, 0, y + alturaFoto, w, alturaCartao - alturaFoto, { titulo, chamada });
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
