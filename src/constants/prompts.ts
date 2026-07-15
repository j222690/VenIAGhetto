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
