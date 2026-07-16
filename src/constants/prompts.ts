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

// Adapta a POSE ao novo cenário — usada só quando o fundo/cenário MUDA. Sem
// isso, a IA copia a pose literal da foto original (ex.: braço erguido
// segurando celular de selfie de espelho) para um cenário onde ela não faz
// sentido nenhum (estúdio sem espelho) — o gesto fica sem propósito na cena.
export const NATURAL_POSE_CLAUSE =
  "Adapte a pose para ficar natural no NOVO cenário — a pessoa não está mais se fotografando: " +
  "remova o celular da mão e qualquer gesto que só fizesse sentido na foto original (ex.: pose de " +
  "selfie de espelho), e substitua por uma pose de pé natural e confiante, como em um still de moda.";

// Preservação do ENQUADRAMENTO original — usada quando o usuário NÃO pede
// mudança de fundo nem refino: mantém foto, ângulo e cenário intactos,
// trocando só as roupas. (Identidade já é tratada por IDENTITY_LOCK_CLAUSE.)
export const PRESERVE_PHOTO_CLAUSE =
  "Mantenha o mesmo enquadramento, proporção, ângulo, fundo/cenário e iluminação da foto original — " +
  "não reenquadre, não corte nem amplie a imagem.";
