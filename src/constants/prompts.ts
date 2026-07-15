// Trechos de prompt reutilizados na geração de imagem (Provador, Posts, Refino).
//
// Ordem importa nestes modelos: a instrução mais crítica (identidade da
// pessoa) vem PRIMEIRO (efeito de primazia) e é repetida no fechamento
// (efeito de recência) — ver IDENTITY_LOCK_CLAUSE/IDENTITY_RECAP_CLAUSE. Um
// prompt único e comprido, sem essa ordenação, faz o modelo tratar o pedido
// como "gerar uma pessoa nova" em vez de "editar esta foto".

// Regra #1, sempre a PRIMEIRA cláusula do prompt: trava a identidade da
// pessoa da foto de referência. Sem isso o modelo tende a "recriar" o rosto
// em vez de editar a foto original (rosto/pose saindo diferentes do cliente).
export const IDENTITY_LOCK_CLAUSE =
  "Isto é uma EDIÇÃO de uma foto real, não a criação de uma pessoa nova. Mantenha EXATAMENTE o " +
  "mesmo rosto, mesmas feições, mesmo tom de pele, mesmo cabelo, mesmo corpo e mesma pose da " +
  "PRIMEIRA imagem enviada — como um editor de fotos trocando só a roupa, nunca reimaginando a " +
  "pessoa. NÃO troque a pessoa por outra, NÃO altere o rosto.";

// Fechamento curto — repete a regra de identidade no FIM do prompt (recência),
// depois de todas as instruções de roupa/cenário, para reforçar prioridade.
export const IDENTITY_RECAP_CLAUSE =
  "Antes de gerar, confira: o rosto e o corpo continuam sendo os da PRIMEIRA imagem — só a roupa mudou.";

// Proporção do corpo — ataca um bug observado: a IA distorcia a proporção
// corpo/cabeça (cabeça grande demais, corpo esticado) ao vestir o look.
export const ANATOMY_CLAUSE =
  "Mantenha as PROPORÇÕES do corpo da pessoa IDÊNTICAS à primeira imagem — não aumente a cabeça nem " +
  "encolha o corpo, mesma altura, mesma largura de ombros/tronco, mesmo comprimento de braços e " +
  "pernas. NÃO dê zoom, reescale nem distorça a pessoa. O corpo deve parecer natural e " +
  "anatomicamente igual ao da imagem original.";

// Evita um bug real observado neste modelo de IA: em vez de vestir a peça na
// pessoa, às vezes ele devolve uma colagem com a pessoa e as fotos de
// referência das peças lado a lado (como um catálogo).
export const NO_COLLAGE_CLAUSE =
  "FORMATO DE SAÍDA (obrigatório): devolva UMA ÚNICA fotografia mostrando SÓ a pessoa, preenchendo o " +
  "quadro como na primeira imagem. NUNCA devolva colagem, grade, montagem, tela dividida ou várias " +
  "imagens lado a lado. NÃO inclua as fotos de referência das peças em nenhum canto do resultado — " +
  "as peças só podem aparecer VESTIDAS na pessoa.";

// Reforço específico contra inventar logo/estampa — mais direto que a regra
// geral de fidelidade (GARMENT_FIDELITY_CLAUSE).
export const NO_INVENT_CLAUSE =
  "Não invente, adicione nem alucine nenhum logo, marca, símbolo, texto ou estampa que não esteja " +
  "claramente visível na peça de referência. Se a peça for lisa, o resultado também é liso.";

// Evita o caso em que a IA devolve a foto original sem de fato aplicar a
// peça nova (fica "parecido demais" e a roupa não muda).
export const MUST_APPLY_CLAUSE =
  "O resultado PRECISA mostrar visivelmente a nova peça vestida na pessoa — nunca devolva a primeira " +
  "imagem sem alteração nenhuma na roupa.";

// Regra de REALISMO aplicada em toda geração/edição de imagem. Reforça um
// resultado fotográfico profissional e evita "cara de IA", além de proibir
// pessoas no fundo (só o modelo em primeiro plano).
export const REALISM_CLAUSE =
  "A imagem precisa ser fotográfica e profissional — iluminação natural coerente, texturas reais de " +
  "tecido e pele, sombras e reflexos condizentes. Evite aparência artificial, plástica ou de " +
  "renderização 3D. O fundo/cenário não deve conter nenhuma pessoa além do modelo em primeiro plano.";

// Fidelidade das PEÇAS — vale para TODA geração/edição. O que aparece é o que a
// loja vende, então as roupas não podem ser inventadas nem alteradas. Cita
// mangas explicitamente porque é uma falha observada: a IA encurtava manga
// longa para manga curta mesmo com a regra genérica de "comprimento".
export const GARMENT_FIDELITY_CLAUSE =
  "Reproduza cada peça de roupa/calçado/acessório EXATAMENTE como nas imagens de referência — mesma " +
  "cor, estampa, textura, corte, comprimento e detalhes, sem inventar, remover nem trocar nenhuma " +
  "peça. Preste atenção especial ao COMPRIMENTO DAS MANGAS: se a peça de referência tem manga longa, " +
  "o resultado tem manga longa; se tem manga curta, o resultado tem manga curta — NUNCA encurte nem " +
  "alongue mangas. É o produto real que será vendido.";

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
