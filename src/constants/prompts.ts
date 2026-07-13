// Trechos de prompt reutilizados na geração de imagem (Provador, Posts, Refino).

// Regra de REALISMO aplicada em toda geração/edição de imagem. Reforça um
// resultado fotográfico profissional e evita "cara de IA", além de proibir
// pessoas no fundo (só o modelo em primeiro plano).
export const REALISM_CLAUSE =
  "IMPORTANTE: o fundo/cenário NÃO deve conter NENHUMA pessoa além do modelo em primeiro plano. " +
  "A imagem precisa ser EXTREMAMENTE profissional, hiper-realista e rica em detalhes — iluminação " +
  "natural coerente, texturas reais de tecido e pele, profundidade de campo, sombras e reflexos " +
  "condizentes — como uma fotografia tirada por câmera profissional. JAMAIS deve parecer uma imagem " +
  "gerada por IA: evite qualquer aparência artificial, plástica, de renderização 3D ou saturada demais.";

// Fidelidade das PEÇAS — vale para TODA geração/edição. O que aparece é o que a
// loja vende, então as roupas não podem ser inventadas nem alteradas.
export const GARMENT_FIDELITY_CLAUSE =
  "REGRA ABSOLUTA: NUNCA altere, adicione ou remova qualquer peça de roupa, calçado ou acessório. " +
  "Reproduza FIELMENTE cada peça exatamente como nas imagens enviadas — mesma cor, estampa, textura, " +
  "corte, comprimento, botões e detalhes. O que aparece é EXATAMENTE o produto que será vendido.";

// Preservação da FOTO original — usada quando o usuário NÃO pede mudança de
// fundo nem refino: mantém a pessoa e a foto intactas, trocando só as roupas.
export const PRESERVE_PHOTO_CLAUSE =
  "Mantenha EXATAMENTE a foto original da pessoa: mesmo enquadramento, mesma proporção (aspect " +
  "ratio), mesmo corte, ângulo, pose, fundo/cenário e iluminação. NÃO reenquadre, NÃO amplie nem " +
  "afaste o zoom, NÃO corte, NÃO expanda a imagem e NÃO mude o fundo. Altere SOMENTE as roupas " +
  "vestidas na pessoa.";
