// composeQuadrant — monta UMA imagem com até 4 peças em grade 2x2, sem IA
// nenhuma (só recorte/posicionamento no canvas do navegador). Usada pra
// aplicar várias peças numa ÚNICA chamada de geração em vez de uma chamada
// de IA por peça (custo cai de N × imagem pra 1 × imagem em looks 2+ peças).
// Quadrantes não usados ficam cinza-liso; o prompt (buildQuadrantClause em
// @/constants/prompts) instrui a IA a ignorá-los.

const CELL = 768;
const QUAD_POSITIONS: [number, number][] = [
  [0, 0],
  [CELL, 0],
  [0, CELL],
  [CELL, CELL],
];

// Exporta o canvas em JPEG cabendo num ORÇAMENTO DE BYTES, baixando a
// qualidade até caber. MEDIDO: normalizar só a área resolveu metade do
// problema — todas as grades saíam com 0,64 MP, mas o PESO ainda variava de
// 137 KB a 296 KB, porque uma foto de origem mais detalhada comprime pior.
// O que trafega e vira token de entrada é byte, não pixel: o cliente com a
// grade de 296 KB era justamente o que falhava. Com orçamento fixo, todo
// cliente manda aproximadamente o mesmo peso.
function toJpegUnder(canvas: HTMLCanvasElement, maxBytes: number): string {
  const qualidades = [0.92, 0.85, 0.78, 0.7, 0.62, 0.55];
  let dataUrl = "";
  for (const q of qualidades) {
    dataUrl = canvas.toDataURL("image/jpeg", q);
    // base64 infla ~4/3; 0.75 devolve o tamanho real em bytes.
    if (dataUrl.length * 0.75 <= maxBytes) break;
  }
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
    img.src = url;
  });
}

// "cover": preenche a célula inteira cortando o excesso, sem distorcer.
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number = CELL,
  h: number = CELL,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export async function composeQuadrant(
  garmentUrls: string[],
): Promise<{ mimeType: string; data: string }> {
  const urls = garmentUrls.slice(0, 4);
  const canvas = document.createElement("canvas");
  canvas.width = CELL * 2;
  canvas.height = CELL * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não suportado.");
  ctx.fillStyle = "#ebebeb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const images = await Promise.all(urls.map(loadImage));
  images.forEach((img, i) => drawCover(ctx, img, QUAD_POSITIONS[i][0], QUAD_POSITIONS[i][1]));

  // Mesmo orçamento de bytes da grade de looks: este quadrante é 1536x1536 e
  // saía a qualidade 0.92 fixa, o que o deixava pesado. Ele é REFERÊNCIA de
  // peça (o modelo copia cor, corte e fechos dali), não a base da saída — o
  // teto de bytes vale aqui pelo mesmo motivo que vale lá.
  return { mimeType: "image/jpeg", data: toJpegUnder(canvas, 150 * 1024) };
}

// composeLookGrid: usada só na Grade de Looks
// (comparar looks completos, não peças). Diferente do composeQuadrant acima
// (sempre 2x2, com espaço vazio se sobrar), o layout aqui se ADAPTA à
// quantidade — 2 looks = lado a lado, 4 = grade 2x2 — pra nunca ter quadrante
// vazio/ambíguo. 3 looks NÃO é suportado (testado e descartado: mesmo com
// layout dedicado, saía com rosto/roupa inconsistentes — ver histórico do
// tryon.tsx, que bloqueia esse caso na UI antes de chegar aqui). Células em
// pé (3:4, igual a uma foto de pessoa de corpo inteiro) em vez de quadradas,
// já que cada célula mostra uma pessoa inteira.
// 360x480 (era 600x800, depois 450x600): a grade de looks é REFERÊNCIA de
// roupa, não a base da saída — não precisa de resolução alta, e cada pixel a
// mais vira token de entrada, que é tempo de resposta. Nesse tamanho a célula
// ainda mostra cor, tecido, corte e fechos com folga, que é o que o prompt
// pede pra copiar. Reduzida junto com a grade da pessoa (que agora tem área
// constante) pra geração caber no alvo de menos de 1 minuto.
const STRIP_CELL_W = 360;
const STRIP_CELL_H = 480;

export interface LookGridLayout {
  composite: { mimeType: string; data: string };
  cols: number;
  rows: number;
  aspectRatio: string;
}

export async function composeLookGrid(lookUrls: string[]): Promise<LookGridLayout> {
  const urls = lookUrls.slice(0, 4);
  const n = urls.length;
  let cols: number;
  let rows: number;
  let aspectRatio: string;
  if (n <= 2) {
    cols = n;
    rows = 1;
    aspectRatio = n === 2 ? "3:2" : "3:4";
  } else {
    cols = 2;
    rows = 2;
    aspectRatio = "3:4";
  }

  const canvas = document.createElement("canvas");
  canvas.width = STRIP_CELL_W * cols;
  canvas.height = STRIP_CELL_H * rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não suportado.");
  ctx.fillStyle = "#ebebeb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const images = await Promise.all(urls.map(loadImage));
  images.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawCover(ctx, img, col * STRIP_CELL_W, row * STRIP_CELL_H, STRIP_CELL_W, STRIP_CELL_H);
  });

  return {
    composite: { mimeType: "image/jpeg", data: toJpegUnder(canvas, 150 * 1024) },
    cols,
    rows,
    aspectRatio,
  };
}

// composePersonGrid — monta uma grade com a MESMA foto da pessoa repetida em
// TODAS as posições, no mesmo layout da grade de looks (composeLookGrid).
//
// Por que isso existe: antes, a Grade de Looks mandava só a foto da pessoa
// (uma vez) e PEDIA por texto que o modelo repetisse rosto, corpo, pose,
// enquadramento e fundo idênticos em cada posição da saída. Era instrução —
// o modelo obedecia mais ou menos, e o resultado saía com rosto variando
// entre painéis e fundo reinventado (bug real: fundo branco em vez do fundo
// da foto). Repetindo a foto no canvas, essas quatro coisas passam a ser
// GEOMETRIA JÁ VERDADEIRA na entrada em vez de um pedido: cada célula já
// contém os pixels certos, e o trabalho do modelo vira só "troque a roupa
// desta célula". Também encurta o prompt (ver buildLookGridClause), o que o
// próprio prompts.ts defende como princípio.
//
// Esta grade é a ÚNICA referência da pessoa enviada: a foto em tamanho cheio
// e o close-up de rosto saíram da chamada quando o payload virou o gargalo
// (a geração passava de 90s e falhava). A pessoa aparece em cada célula, o
// que já cobre rosto, pose, enquadramento e fundo.

// Formatos que o Gemini aceita na saída (espelha SUPPORTED_ASPECT_RATIOS da
// Edge Function generate-image) — a grade precisa pedir o mais próximo do seu
// formato real, senão o modelo espreme a imagem pra caber no padrão dele.
const OUTPUT_RATIOS: [string, number][] = [
  ["1:1", 1],
  ["2:3", 2 / 3],
  ["3:2", 3 / 2],
  ["3:4", 3 / 4],
  ["4:3", 4 / 3],
  ["4:5", 4 / 5],
  ["5:4", 5 / 4],
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
  ["21:9", 21 / 9],
];
function nearestRatio(w: number, h: number): string {
  const r = w / h;
  let best = OUTPUT_RATIOS[0];
  let bestDiff = Infinity;
  for (const cand of OUTPUT_RATIOS) {
    const d = Math.abs(Math.log(r) - Math.log(cand[1]));
    if (d < bestDiff) {
      bestDiff = d;
      best = cand;
    }
  }
  return best[0];
}

export async function composePersonGrid(
  photoUrl: string,
  cols: number,
  rows: number,
): Promise<{ mimeType: string; data: string; aspectRatio: string }> {
  const img = await loadImage(photoUrl);

  // A célula usa o MESMO formato da foto, em vez do 3:4 fixo da grade de
  // looks. BUG REAL que isso corrige: com drawCover + célula 3:4, uma foto
  // muito vertical (observado: 600x1600, comum em foto de corpo inteiro de
  // celular) era recortada no meio — a IA recebia a pessoa DECAPITADA e sem
  // os pés, e reproduzia fielmente o que recebeu. Igualando o formato da
  // célula ao da foto, a pessoa entra inteira, sem corte e sem borda vazia.
  // A altura é limitada pra uma foto absurdamente longa não gerar um canvas
  // gigante (o limite entra como leve corte, muito melhor que decapitar).
  // Célula com ÁREA constante, não altura constante. MEDIDO: com altura fixa
  // de 640px, o peso da requisição passava a depender do FORMATO da foto que
  // o lojista subiu — foto vertical (605x1600) gerava uma grade de 0,62 MP,
  // foto deitada gerava 3,28 MP. Cinco vezes mais dados para alguns clientes,
  // sem ganho nenhum, e foi provavelmente o que fez 3 de 5 gerações estourarem
  // o timeout enquanto outras passavam. Fixando a ÁREA, toda foto — vertical,
  // quadrada ou deitada — manda o mesmo peso, e o tempo de geração para de
  // depender de quem é o cliente.
  const ratio = Math.min(Math.max(img.width / img.height, 0.35), 2);
  const CELL_AREA = 160_000; // ~400x400; com ratio 0.38 vira ~246x650
  const cellW = Math.round(Math.sqrt(CELL_AREA * ratio));
  const cellH = Math.round(Math.sqrt(CELL_AREA / ratio));

  const canvas = document.createElement("canvas");
  canvas.width = cellW * cols;
  canvas.height = cellH * rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não suportado.");
  ctx.fillStyle = "#ebebeb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawCover(ctx, img, col * cellW, row * cellH, cellW, cellH);
  }

  // O formato de SAÍDA tem que seguir a grade da PESSOA (é ela que está sendo
  // replicada), não a grade de looks — que tem célula 3:4 fixa e formato
  // diferente.
  return {
    mimeType: "image/jpeg",
    data: toJpegUnder(canvas, 150 * 1024),
    aspectRatio: nearestRatio(cellW * cols, cellH * rows),
  };
}

// cropFaceCloseup: recorta um close-up do ROSTO
// da foto da pessoa pra usar como referência EXTRA de identidade na Grade de
// Looks (o rosto tende a variar entre os painéis quando o modelo só tem a
// foto de corpo inteiro, pequena, pra se basear). Tenta a Shape Detection API
// do navegador (FaceDetector) pra recortar justo ao redor do rosto; sem
// suporte (ou se não achar rosto), cai num recorte heurístico da região
// superior-central da foto, que cobre o rosto na maioria das fotos de
// provador (pessoa de corpo inteiro, centralizada, de frente).
const CLOSEUP_SIZE = 512;

export async function cropFaceCloseup(
  photoUrl: string,
): Promise<{ mimeType: string; data: string }> {
  const img = await loadImage(photoUrl);
  let box = { x: img.width * 0.2, y: img.height * 0.02, w: img.width * 0.6, h: img.height * 0.32 };

  const FaceDetectorCtor = (
    window as unknown as {
      FaceDetector?: new () => {
        detect(
          img: HTMLImageElement,
        ): Promise<{ boundingBox: { x: number; y: number; width: number; height: number } }[]>;
      };
    }
  ).FaceDetector;
  if (FaceDetectorCtor) {
    try {
      const detector = new FaceDetectorCtor();
      const faces = await detector.detect(img);
      if (faces.length > 0) {
        const { x, y, width, height } = faces[0].boundingBox;
        // Expande a caixa detectada (só o rosto, justo) pra incluir um pouco
        // de testa/queixo/orelhas — margem de 80% em cada lado.
        const margin = 0.8;
        const mx = width * margin;
        const my = height * margin;
        box = {
          x: Math.max(0, x - mx),
          y: Math.max(0, y - my),
          w: Math.min(img.width, width + mx * 2),
          h: Math.min(img.height, height + my * 2),
        };
      }
    } catch {
      /* sem suporte real (ou falha de detecção) — segue com o recorte heurístico */
    }
  }

  // Canvas no MESMO aspect ratio do recorte (maior lado = CLOSEUP_SIZE) — um
  // canvas quadrado forçado esticaria o recorte (a caixa do rosto raramente
  // é quadrada), distorcendo justo o rosto que essa referência devia deixar
  // mais fiel.
  const boxAspect = box.w / box.h;
  const canvas = document.createElement("canvas");
  canvas.width = boxAspect >= 1 ? CLOSEUP_SIZE : Math.round(CLOSEUP_SIZE * boxAspect);
  canvas.height = boxAspect >= 1 ? Math.round(CLOSEUP_SIZE / boxAspect) : CLOSEUP_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não suportado.");
  ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { mimeType: "image/jpeg", data: base64 };
}
