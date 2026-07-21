// Trechos de prompt reutilizados na geração de imagem (Provador, Posts, Refino).
//
// Prompt enxuto > prompt comprido: um texto com muitas regras empilhadas
// dilui a atenção do modelo entre elas — cada regra "compete" com as outras
// por peso. O motor de referência que comprovadamente funciona bem usa só
// ~4 blocos de instrução, diretos e sem repetir a mesma ideia em textos
// diferentes. Por isso aqui cada cláusula cobre UM problema real observado,
// sem sobrepor conteúdo com as outras — cláusulas fundidas (ex.: identidade +
// troca de roupa) valem mais que cláusulas separadas dizendo coisas parecidas.
//
// Ordem importa: a instrução mais crítica (identidade + troca de roupa) vem
// PRIMEIRO (efeito de primazia). Sem isso, o modelo tende a tratar o pedido
// como "gerar uma pessoa nova" em vez de "editar esta foto".

// Regra #1, sempre a PRIMEIRA cláusula do prompt: identidade travada + troca
// de roupa como uma coisa só. Funde 3 problemas reais observados que antes
// eram 3 cláusulas separadas (identidade, "a peça antiga precisa sumir",
// "não devolva a foto sem alteração") — juntos em um parágrafo só, na ordem
// em que o modelo precisa aplicá-los, em vez de regras soltas repetindo a
// mesma ideia com palavras diferentes.
export const IDENTITY_LOCK_CLAUSE =
  "Isto é uma EDIÇÃO de uma foto real, não a criação de uma pessoa nova — mantenha EXATAMENTE o mesmo " +
  "rosto, tom de pele, cabelo, corpo e pose da PRIMEIRA imagem, como um editor de fotos trocando só a " +
  "roupa. É uma TROCA DE ROUPA: a peça que a pessoa já está usando naquela região do corpo precisa " +
  "DESAPARECER por completo — nunca fica visível por baixo, por cima, ao lado ou misturada com a peça " +
  "nova (ex.: se a pessoa está de bermuda e o novo look é uma calça, a bermuda some inteira, só a " +
  "calça aparece). O resultado PRECISA mostrar uma roupa claramente diferente da original — nunca " +
  "devolva a primeira imagem sem alteração na roupa.";

// Proporção do corpo — ataca um bug observado: a IA distorcia a proporção
// corpo/cabeça (cabeça grande demais, corpo esticado) ao vestir o look.
export const ANATOMY_CLAUSE =
  "Mantenha as PROPORÇÕES do corpo da pessoa IDÊNTICAS à primeira imagem — não aumente a cabeça nem " +
  "encolha o corpo, mesma altura, mesma largura de ombros/tronco, mesmo comprimento de braços e " +
  "pernas. NÃO dê zoom, reescale nem distorça a pessoa.";

// Evita um bug real observado neste modelo de IA: em vez de vestir a peça na
// pessoa, às vezes ele devolve uma colagem com a pessoa e as fotos de
// referência das peças lado a lado (como um catálogo).
export const NO_COLLAGE_CLAUSE =
  "FORMATO DE SAÍDA (obrigatório): devolva UMA ÚNICA fotografia mostrando SÓ a pessoa, preenchendo o " +
  "quadro como na primeira imagem. NUNCA devolva colagem, grade, montagem, tela dividida ou várias " +
  "imagens lado a lado, e NÃO inclua as fotos de referência das peças em nenhum canto do resultado.";

// Fidelidade das PEÇAS — vale para TODA geração/edição. Funde a regra geral
// de fidelidade (cor/estampa/corte/comprimento) com a proibição de inventar
// logo/marca, que antes eram 2 cláusulas dizendo praticamente a mesma coisa
// ("reproduza exatamente") de dois jeitos diferentes. Cita mangas
// explicitamente porque é uma falha observada: a IA encurtava manga longa
// para manga curta mesmo com a regra genérica de "comprimento".
export const GARMENT_FIDELITY_CLAUSE =
  "Reproduza cada peça de roupa/calçado/acessório EXATAMENTE como nas imagens de referência — mesma " +
  "cor, estampa, textura, corte e comprimento (mangas incluídas: manga longa continua longa, manga " +
  "curta continua curta). Não invente, adicione nem troque nenhum logo, marca, símbolo ou estampa que " +
  "não esteja visível na peça de referência; se ela for lisa, o resultado também é liso. É o produto " +
  "real que será vendido — fidelidade da peça tem prioridade sobre estética.";

// Regra de REALISMO aplicada em toda geração/edição de imagem. Reforça um
// resultado fotográfico profissional e evita "cara de IA", além de proibir
// pessoas no fundo (só o modelo em primeiro plano).
export const REALISM_CLAUSE =
  "A imagem precisa ser fotográfica e profissional — iluminação natural coerente, texturas reais de " +
  "tecido e pele, sombras e reflexos condizentes. Evite aparência artificial, plástica ou de " +
  "renderização 3D. O fundo/cenário não deve conter nenhuma pessoa além do modelo em primeiro plano.";

// OBSOLETA — mantida só de referência. Antes, ao mudar de cenário, pedia pra
// IA adaptar a pose (tirar celular da mão de selfie etc.), porque uma pose
// de "tirando foto no espelho" não faz sentido num fundo gerado do zero. O
// usuário pediu explicitamente pra pose NUNCA mudar, nem trocando o fundo —
// ver POSE_LOCK_CLAUSE, que faz o oposto (trava a pose sempre).
export const NATURAL_POSE_CLAUSE =
  "Adapte a pose para ficar natural no NOVO cenário — a pessoa não está mais se fotografando: " +
  "remova o celular da mão e qualquer gesto que só fizesse sentido na foto original (ex.: pose de " +
  "selfie de espelho), e substitua por uma pose de pé natural e confiante, como em um still de moda.";

// Pedido explícito do usuário: ao mudar SÓ o fundo/cenário, a pose (e
// qualquer objeto na mão, ex.: celular de selfie) tem que continuar
// EXATAMENTE igual à foto original — mesmo que não faça muito sentido no
// fundo novo. Só o fundo/roupa mudam, nada do gesto da pessoa.
export const POSE_LOCK_CLAUSE =
  "POSE LOCK (mandatory): even though the background/scene is changing, the person's POSE, body " +
  "position and any object in their hand (e.g. a phone) must stay EXACTLY as in the original photo — " +
  "do not adapt, naturalize or change the pose or gesture just because the background is different. " +
  "Only the background/scene and the clothing change; the person's pose is untouched.";

// Preservação do ENQUADRAMENTO original — usada quando o usuário NÃO pede
// mudança de fundo nem refino: mantém foto, ângulo e cenário intactos,
// trocando só as roupas. (Identidade já é tratada por IDENTITY_LOCK_CLAUSE.)
export const PRESERVE_PHOTO_CLAUSE =
  "Mantenha o mesmo enquadramento, proporção, ângulo, fundo/cenário e iluminação da foto original — " +
  "não reenquadre, não corte nem amplie a imagem.";

// ---------------------------------------------------------------------------
// TESTE LOCAL (NÃO COMMITAR) — cópia literal do prompt do app de referência
// (repositorioghetto, função tryon-enqueue, Gemini direto), em inglês, sem
// tradução. O usuário confirmou que essa versão funciona bem lá. Objetivo:
// isolar se o problema de fidelidade de cor/textura é a REDAÇÃO do prompt
// (idioma/estrutura) e não o conteúdo das regras, que já é equivalente ao
// nosso. Ordem de uso é a mesma do original: TASK + ANATOMY + NO_COLLAGE +
// NO_INVENT, sempre nessa sequência.
// ---------------------------------------------------------------------------
export const REF_APP_TASK_CLAUSE =
  "You are a virtual try-on engine. IMAGE 1 = a real person. The following image(s) = clothing item(s). " +
  "TASK: produce a NEW photo of the SAME person now WEARING the garment(s) from the following image(s). " +
  "This is a CLOTHING SWAP: the new garment(s) must VISIBLY REPLACE the clothing the person currently " +
  "wears in that area — their current/old clothing must be GONE and replaced by the new item(s). " +
  "The output MUST clearly differ from IMAGE 1 in the clothing — do NOT simply return image 1 " +
  "unchanged. Keep ONLY the person's face, hair, skin tone, body shape, pose and background the same; " +
  "fit the new garment(s) naturally with realistic folds, lighting and shadows. Output only the final " +
  "edited image.";

export const REF_APP_ANATOMY_CLAUSE =
  "CRITICAL ANATOMY & PROPORTIONS: Keep the person's body proportions IDENTICAL to the first image. " +
  "Do NOT enlarge the head or shrink the body. Keep the EXACT head-to-body ratio, the same height, the " +
  "same shoulder/torso width and the same arm/leg length. Do NOT zoom, rescale or distort the person. " +
  "Keep the same camera framing, crop and aspect ratio. The body must look natural and anatomically the " +
  "same as the input.";

export const REF_APP_NO_COLLAGE_CLAUSE =
  "OUTPUT FORMAT (mandatory): return ONE single photograph showing ONLY the person, filling the frame " +
  "EXACTLY like IMAGE 1. NEVER output a collage, grid, montage, split-screen, side-by-side or " +
  "multi-panel image. Do NOT include the separate garment photos, product images, swatches or any " +
  "extra panel anywhere in the result. The garment(s) must appear ONLY as real clothing worn on the " +
  "person's body — never shown as separate items beside, around or behind them.";

// Reforço de detalhes CONSTRUTIVOS (não só cor/textura) — bug real observado:
// a braguilha/fechamento de uma calça saiu fora do centro (a peça real tem o
// fechamento reto no meio; o resultado colocou torto/deslocado). A cláusula
// original só cita "shape" de forma vaga, sem falar da POSIÇÃO de botão/
// zíper/bolsos/costuras — que é exatamente o que escapou.
// Cláusula de FECHAMENTO (sempre a ÚLTIMA do prompt). Bug real: o REALISM_CLAUSE
// no fim empurrava o modelo a "embelezar" e RE-RENDERIZAR a peça (mudando fecho/
// textura/modelo). Por recência, a última instrução ganha peso — então a última
// tem que ser FIDELIDADE, não estética. Neutraliza explicitamente o "melhorar".
export const REF_APP_FIDELITY_CLOSING_CLAUSE =
  "FINAL AND MOST IMPORTANT INSTRUCTION (overrides any earlier request to make the photo look nicer or " +
  "more professional): this is a REAL product that will be sold — the garment(s) must remain 100% " +
  "IDENTICAL to the reference image in model/cut, fabric texture, exact color, seams and closure " +
  "(fly, button and zipper in the EXACT same position and size). Do NOT redraw, re-model, beautify, " +
  "smooth out, simplify or 'upgrade' the garment; do NOT turn one pants model into another; keep every " +
  "construction detail exactly as photographed. Only the person is being dressed — the garment itself " +
  "is copied unchanged. Garment fidelity ALWAYS wins over the beauty or polish of the image.";

export const REF_APP_NO_INVENT_CLAUSE =
  "FAITHFUL GARMENTS (mandatory): reproduce each garment EXACTLY as shown in its reference image — " +
  "same color, knit, pattern and shape. This includes ALL construction details in their EXACT original " +
  "position: button/zipper fly centered exactly where it is in the reference (do not shift it sideways), " +
  "pockets, seams, stitching lines, collar and cuffs in the same place and style as shown. Do NOT " +
  "invent, add, draw or hallucinate ANY logo, brand mark, emblem, badge, symbol, icon, text, lettering, " +
  "monogram, print or graphic that is not clearly visible on the garment. If a garment is plain/solid, " +
  "keep it completely plain — absolutely no added marks, chest logos or decorations of any kind.";

// TESTE LOCAL (NÃO COMMITAR) — aplicação SEQUENCIAL de peças: bug real
// observado quando várias peças vão numa ÚNICA chamada ("veste o look
// completo") — o modelo aplica só uma e ignora as outras. O app de
// referência NUNCA manda várias peças de uma vez: aplica uma peça por vez,
// usando o resultado do passo anterior como nova "pessoa" de entrada
// (PROMPT_MULTI_TOP → PROMPT_MULTI_BOTTOM encadeados). stepIndex 0 = a
// PRIMEIRA peça aplicada nesta geração (edita a foto original — mesmo texto
// de REF_APP_TASK_CLAUSE). stepIndex > 0 = peça seguinte, aplicada sobre o
// resultado do passo anterior (que JÁ tem outra(s) peça(s) vestida(s) — essas
// precisam ficar intactas, só a região da peça nova pode mudar).
export function buildSequentialStepClause(stepIndex: number): string {
  if (stepIndex === 0) return REF_APP_TASK_CLAUSE + " " + CLOTHING_FULL_REARRANGE_CLAUSE;
  return (
    "You are a virtual try-on engine continuing a MULTI-STEP look. IMAGE 1 = the person ALREADY " +
    "wearing a look applied in a previous step — that look (all garments already on the person) must " +
    "stay EXACTLY as shown, unchanged. The following image = ONE NEW garment to ADD to the look. " +
    "TASK: add this new garment to the person, replacing ONLY the clothing in the body region this " +
    "garment belongs to (e.g. a pants image replaces only the current bottom-body clothing) — do NOT " +
    "remove, alter or replace any other already-applied garment. The output MUST clearly show this new " +
    "garment on the person — do not simply return IMAGE 1 unchanged. Keep the person's face, hair, " +
    "skin tone, body shape, pose, camera framing and background identical. Fit the new garment " +
    "naturally with realistic folds, lighting and shadows. Output only the final edited image. " +
    CLOTHING_FULL_REARRANGE_CLAUSE
  );
}

// Aplicação em quadrantes — substitui a aplicação SEQUENCIAL (uma chamada de
// IA por peça) por UMA chamada só, pra cortar custo em looks de 2+ peças (N
// chamadas de imagem viravam N × custo real). A imagem 2 é uma grade 2x2
// montada no FRONTEND (sem IA, só recorte/posicionamento): cada quadrante
// preenchido tem UMA peça; quadrantes vazios são cinza-liso e devem ser
// ignorados. `pieceCount` é quantos quadrantes (1 a 4) estão preenchidos, na
// ORDEM: superior-esquerdo, superior-direito, inferior-esquerdo,
// inferior-direito — a MESMA ordem da descrição em `piecesPart` (cada linha
// da descrição corresponde, em ordem, a um quadrante preenchido).
const QUADRANT_LABELS = ["superior-esquerdo", "superior-direito", "inferior-esquerdo", "inferior-direito"];

// Descreve a grade de quadrantes em si (reutilizável nos dois casos: editar
// pessoa existente = grade é a "SEGUNDA" imagem; criar modelo do zero = grade
// é a "ÚNICA" imagem, já que não tem foto de pessoa nenhuma pra editar).
function quadrantReferenceNote(pieceCount: number, imageLabel: "SEGUNDA" | "ÚNICA"): string {
  const used = QUADRANT_LABELS.slice(0, pieceCount).join(", ");
  const empty = QUADRANT_LABELS.slice(pieceCount);
  const emptyPart = empty.length
    ? ` Os quadrantes ${empty.join(" e ")} estão VAZIOS (cinza-liso) — IGNORE-OS por completo, eles não representam nenhuma peça.`
    : "";
  const orderList =
    `1ª peça descrita = quadrante ${QUADRANT_LABELS[0]}` +
    `${pieceCount > 1 ? `, 2ª peça = ${QUADRANT_LABELS[1]}` : ""}` +
    `${pieceCount > 2 ? `, 3ª peça = ${QUADRANT_LABELS[2]}` : ""}` +
    `${pieceCount > 3 ? `, 4ª peça = ${QUADRANT_LABELS[3]}` : ""}`;
  return (
    `A imagem ${imageLabel} é uma grade de referência dividida em 4 quadrantes (2x2). Os quadrantes ${used} ` +
    `cada um mostra UMA peça de roupa/calçado diferente, na MESMA ordem da descrição das peças dada a ` +
    `seguir (${orderList}).${emptyPart}`
  );
}

export function buildQuadrantClause(pieceCount: number): string {
  return (
    quadrantReferenceNote(pieceCount, "SEGUNDA") +
    ` TASK: vista a pessoa da PRIMEIRA imagem com TODAS as ${pieceCount} peças mostradas nos quadrantes ` +
    `preenchidos ao mesmo tempo — cada peça na região do corpo correspondente ao seu tipo (ex.: peça de ` +
    `cima no tronco, peça de baixo nas pernas, calçado nos pés). NÃO aplique só uma peça e ignore as ` +
    `outras — todas as ${pieceCount} precisam aparecer no resultado. NÃO adicione nenhum acessório ` +
    `(óculos, bolsa, joia, chapéu etc.) que não esteja em uma das peças enviadas. ` +
    CLOTHING_MULTI_REARRANGE_CLAUSE
  );
}

// Variante pra CRIAR um modelo do zero (Posts sem foto própria) vestindo
// 2-4 peças de uma vez — não tem "pessoa da primeira imagem" pra editar, a
// grade é a ÚNICA imagem de referência.
export function buildQuadrantFromScratchClause(pieceCount: number, modelDesc: string): string {
  return (
    `Crie uma foto de moda profissional para redes sociais de um(a) ${modelDesc} vestindo TODAS as ` +
    `${pieceCount} peças mostradas na grade de referência anexada, cada peça na região do corpo ` +
    `correspondente ao seu tipo (ex.: peça de cima no tronco, peça de baixo nas pernas, calçado nos ` +
    `pés). NÃO aplique só uma peça e ignore as outras — todas as ${pieceCount} precisam aparecer no ` +
    `resultado. NÃO adicione nenhum acessório (óculos, bolsa, joia, chapéu etc.) que não esteja em ` +
    `uma das peças enviadas. ` +
    quadrantReferenceNote(pieceCount, "ÚNICA")
  );
}

// Variante PLURAL de CLOTHING_FULL_REARRANGE_CLAUSE, para quando VÁRIAS peças
// (uma por quadrante) são aplicadas na MESMA chamada — a versão original fala
// de "a peça nova desta etapa" (singular, feita pro fluxo sequencial); aqui
// cada peça nova tem sua própria região liberada, e só as regiões SEM
// nenhuma peça nova (ex.: sapato, quando só camisa+calça foram enviadas)
// ficam ancoradas na foto original.
export const CLOTHING_MULTI_REARRANGE_CLAUSE =
  "CLOTHING SCOPE (mandatory, narrow): this rule applies to each body region covered by one of the NEW " +
  "garments shown in the quadrant grid (e.g. a pants quadrant frees ONLY the lower-body region; a shirt " +
  "quadrant frees ONLY the torso region). In each such region, nothing from the original photo is " +
  "anchored except the person's face/body physiognomy — fully replace whatever was there (old garment, " +
  "old layering) with the corresponding new garment, from scratch. ANY body region NOT covered by one " +
  "of the new garments (e.g. shoes/accessories, if no shoe quadrant was provided) is OUTSIDE this rule " +
  "and must stay 100% pixel-identical to the original photo — do not redesign, restyle or invent " +
  "anything for a region no new garment covers.";

// Pedido explícito do usuário: a única coisa que vem da foto original nessa
// REGIÃO DO CORPO (a região da peça sendo trocada) é rosto/fisionomia — o
// resto da roupa NAQUELA região deve ser rearrumado do zero conforme a peça
// nova, sem preservar remanescente da peça antiga ali (ex.: bermuda por
// baixo da calça nova). BUG REAL que essa cláusula causou numa versão
// anterior mais ampla: dizia "estilize com um look COMPLETAMENTE NOVO", e ao
// mandar só a calça, a IA reinventou a camisa também (que não devia ter sido
// tocada). Agora é explícito: só a região da peça enviada é livre — todo o
// RESTO do look (peças não enviadas nesta geração) fica 100% como na foto.
export const CLOTHING_FULL_REARRANGE_CLAUSE =
  "CLOTHING SCOPE (mandatory, narrow): this rule applies ONLY to the body region covered by the NEW " +
  "garment provided in this step (e.g. if the new garment is pants, this applies ONLY to the " +
  "lower-body region). In that specific region, nothing from the original photo is anchored except " +
  "the person's face/body physiognomy — fully replace whatever was there (old garment, old layering) " +
  "with the new garment, from scratch. EVERY OTHER garment the person is already wearing that is NOT " +
  "being replaced in this step (e.g. their top/shirt, shoes, accessories) is OUTSIDE this rule and " +
  "must stay 100% pixel-identical to the original photo — do not redesign, restyle or invent a new " +
  "outfit for any region other than the one the new garment covers.";

// Bug real observado: ao mudar o cenário/fundo (praia, festa, etc.), a luz
// ambiente "vazava" pro tecido e mudava a cor da peça (calça azul saindo
// clara/lavada). Esta cláusula separa explicitamente SOMBRA/BRILHO (pode
// variar com a cena) de COR BASE (não pode variar nunca) — só entra no
// prompt quando o cenário é alterado.
export const COLOR_LIGHT_INDEPENDENCE_CLAUSE =
  "LIGHTING VS COLOR (mandatory): the new scene's lighting must NEVER shift the garment's base hue or " +
  "color. Apply realistic brightness and shadow variation from the new lighting/environment, but the " +
  "garment's intrinsic color must stay visually identical to its reference photo — do not tint, warm " +
  "up, cool down, wash out or desaturate the garment to match the ambient light color. Only the " +
  "light/dark shading may change with the scene, never the underlying color itself.";

// TESTE LOCAL (NÃO COMMITAR) — resolve uma contradição real: REF_APP_NO_INVENT_CLAUSE
// manda manter o "shape" da peça EXATAMENTE igual à referência, o que cancela
// qualquer pedido de caimento/comprimento (ex.: "mais justo"). Esta cláusula
// abre uma exceção EXPLÍCITA, deixando claro que ajustar caimento não é
// "inventar" a peça — só entra no prompt quando o usuário realmente pediu
// tamanho/caimento/comprimento.
export function fitExceptionClause(specText: string): string {
  return (
    `FIT EXCEPTION (allowed and required, overrides shape-fidelity above): keep the garment's color, ` +
    `pattern and fabric identical to the reference, but adjust its CUT/FIT as requested: ${specText}. ` +
    `This is an intentional silhouette change, not "inventing" the garment.`
  );
}
