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
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number) {
  const scale = Math.max(CELL / img.width, CELL / img.height);
  const sw = CELL / scale;
  const sh = CELL / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, CELL, CELL);
}

export async function composeQuadrant(garmentUrls: string[]): Promise<{ mimeType: string; data: string }> {
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
