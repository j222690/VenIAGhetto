// Opções de look compartilhadas entre Provador e Posts — tamanho/caimento/
// comprimento das peças, e cenários de fundo. Extraído para um só lugar
// porque as duas telas usavam listas idênticas duplicadas.

export const SIZES = ["PP", "P", "M", "G", "GG", "G1", "G2", "G3"];

// Descrições bem CONCRETAS/visuais (contorno, folga em cm, onde cola no
// corpo) em vez de adjetivo vago tipo "justo" — mudança de caimento é uma
// mudança GEOMÉTRICA (silhueta), o tipo de instrução que a IA de imagem tem
// mais dificuldade de seguir só com texto; quanto mais concreta a descrição,
// melhor a chance de ela realmente redesenhar a silhueta.
export const FITS: { id: string; label: string; desc: string }[] = [
  {
    id: "skinny",
    label: "Skinny",
    desc:
      "corte SKINNY: a perna da calça cola no corpo do quadril ao tornozelo, SEM NENHUMA folga de " +
      "tecido sobrando, mostrando claramente o contorno da coxa, joelho e panturrilha — como uma " +
      "segunda pele, tecido esticado junto ao corpo",
  },
  {
    id: "slim",
    label: "Slim",
    desc:
      "corte SLIM: pernas afuniladas e ajustadas, com uma folga pequena (2 a 3 cm) de tecido — " +
      "acompanha o contorno da perna sem colar totalmente nem sobrar tecido",
  },
  {
    id: "regular",
    label: "Regular",
    desc:
      "corte REGULAR: caimento reto e uniforme da coxa ao tornozelo, com folga moderada visível — " +
      "nem colado no corpo nem largo",
  },
  {
    id: "oversized",
    label: "Oversized",
    desc:
      "corte OVERSIZED: pernas visivelmente LARGAS, com bastante volume de tecido sobrando e caindo " +
      "solto ao redor de toda a perna — silhueta ampla e propositalmente folgada, sem colar em " +
      "nenhum ponto do corpo",
  },
  {
    id: "loose",
    label: "Loose",
    desc:
      "corte LOOSE: caimento solto com folga de tecido perceptível ao longo de toda a perna, " +
      "balançando livremente, sem colar ao corpo em nenhum ponto",
  },
];

// "Comprimento" = barra/bainha da peça (ex.: saia, vestido, blusa) — NUNCA a
// manga. O texto deixa isso explícito para a IA não confundir os dois.
export const LENGTHS: { id: string; label: string; desc: string }[] = [
  { id: "cropped", label: "Cropped", desc: "barra cropped, bem curta, acima da cintura" },
  { id: "curto", label: "Curto", desc: "barra curta" },
  { id: "medio", label: "Médio", desc: "barra média" },
  { id: "longo", label: "Longo", desc: "barra longa" },
  { id: "maxi", label: "Maxi", desc: "barra maxi, até os pés" },
];

// Cenários por ocasião — descrições ricas e concretas (elementos visuais,
// materiais, hora do dia, tipo de luz específico) em vez de frases genéricas
// tipo "praia ensolarada". Frase vaga = a IA cai no "fundo de banco de
// imagens" genérico; detalhe concreto = composição mais real e específica.
// `refUrl`: foto de referência REAL do cenário (sem pessoa), gerada uma vez e
// hospedada no bucket `generated` — dá pro Gemini uma referência VISUAL do
// ambiente em vez de só descrição em texto, que antes saía genérico/plástico
// (a IA "inventava" o cenário do zero). Pra trocar por foto de verdade, só
// substituir a URL aqui — ver comentário de padrão em PresetLibrary.ts.
export const BACKGROUNDS: { id: string; label: string; emoji: string; desc: string; refUrl: string }[] = [
  {
    id: "estudio",
    label: "Estúdio",
    emoji: "📸",
    desc:
      "estúdio fotográfico profissional com fundo infinito cinza-claro (papel ciclorama sem dobras " +
      "visíveis), duas softboxes laterais criando luz suave e direcional, leve sombra de contato no " +
      "chão, sem props no cenário — clima de editorial de revista de moda",
    refUrl:
      "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/generated/46a3fd7c-c311-45f9-932c-bf535228c9e9/58bf22ea-05db-4a26-98c5-3e0c294d5dfb.jpg",
  },
  {
    id: "praia",
    label: "Praia",
    emoji: "🏖️",
    desc:
      "praia tropical ao entardecer, areia branca fina em primeiro plano, ondas suaves desfocadas ao " +
      "fundo, silhuetas de coqueiros recortadas contra um céu em tons de laranja e rosa do pôr do sol, " +
      "luz dourada rasante batendo de lado no rosto e no corpo",
    refUrl:
      "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/generated/46a3fd7c-c311-45f9-932c-bf535228c9e9/930ace94-50b2-457c-98c9-170899d353d7.jpg",
  },
  {
    id: "urbano",
    label: "Urbano",
    emoji: "🏙️",
    desc:
      "calçada de rua urbana contemporânea, fachada de prédio de tijolo aparente com um mural de " +
      "grafite discreto desfocado ao fundo, poste de luz de ferro fundido próximo, piso de " +
      "paralelepípedo, luz de fim de tarde criando sombras longas e tom levemente quente",
    refUrl:
      "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/generated/46a3fd7c-c311-45f9-932c-bf535228c9e9/35916e3b-7c3a-4692-892a-ce15e336beb5.jpg",
  },
  {
    id: "natureza",
    label: "Natureza",
    emoji: "🌳",
    desc:
      "trilha em um parque arborizado, árvores altas com folhagem verde intensa desfocada ao fundo, " +
      "luz de sol filtrada entre as folhas criando pontos de luz salpicados (dappled light) sobre a " +
      "pessoa, grama curta e bem cuidada no chão",
    refUrl:
      "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/generated/46a3fd7c-c311-45f9-932c-bf535228c9e9/741d1754-249d-4953-8ec5-81159b9240b1.jpg",
  },
  {
    id: "trabalho",
    label: "Trabalho",
    emoji: "💼",
    desc:
      "escritório corporativo moderno com paredes de vidro, mesas de madeira clara e uma planta " +
      "grande desfocada ao fundo, luz natural entrando por janelas amplas do lado, ambiente clean, " +
      "minimalista e bem iluminado",
    refUrl:
      "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/generated/46a3fd7c-c311-45f9-932c-bf535228c9e9/571ab827-459f-42a0-8b40-37cfb440670a.jpg",
  },
  {
    id: "casamento",
    label: "Evento",
    emoji: "🥂",
    desc:
      "salão de eventos elegante com lustres de cristal desfocados ao fundo, mesas decoradas com " +
      "toalhas brancas e arranjos florais discretos, luz quente e âmbar, atmosfera sofisticada de gala",
    refUrl:
      "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/generated/46a3fd7c-c311-45f9-932c-bf535228c9e9/c5436845-5dd6-4c2a-a0f0-92dfb4679e11.jpg",
  },
];
