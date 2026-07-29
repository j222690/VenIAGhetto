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

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { mimeType: "image/jpeg", data: base64 };
}

// EXPERIMENTAL (teste local) — composeLookGrid: usada só na Grade de Looks
// (comparar looks completos, não peças). Diferente do composeQuadrant acima
// (sempre 2x2, com espaço vazio se sobrar), o layout aqui se ADAPTA à
// quantidade — 2 looks = lado a lado, 4 = grade 2x2 — pra nunca ter quadrante
// vazio/ambíguo. 3 looks NÃO é suportado (testado e descartado: mesmo com
// layout dedicado, saía com rosto/roupa inconsistentes — ver histórico do
// tryon.tsx, que bloqueia esse caso na UI antes de chegar aqui). Células em
// pé (3:4, igual a uma foto de pessoa de corpo inteiro) em vez de quadradas,
// já que cada célula mostra uma pessoa inteira.
const STRIP_CELL_W = 600;
const STRIP_CELL_H = 800;

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

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { composite: { mimeType: "image/jpeg", data: base64 }, cols, rows, aspectRatio };
}

// EXPERIMENTAL (teste local) — cropFaceCloseup: recorta um close-up do ROSTO
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
