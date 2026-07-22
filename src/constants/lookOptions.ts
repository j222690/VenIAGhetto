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
// `refs`: fotos de referência REAIS do cenário (1 ou mais por categoria) —
// dão pro Gemini uma referência VISUAL do ambiente em vez de só descrição em
// texto, que antes saía genérico/plástico (a IA "inventava" o cenário do
// zero). Quando há mais de uma opção, o usuário escolhe qual usar (ver
// BackgroundRefPicker). Pra trocar/adicionar foto, só editar essa lista.
export interface BackgroundRef {
  label: string;
  url: string;
}
export const BACKGROUNDS: { id: string; label: string; emoji: string; desc: string; refs: BackgroundRef[] }[] = [
  {
    id: "estudio",
    label: "Estúdio",
    emoji: "📸",
    desc:
      "estúdio fotográfico profissional com fundo infinito cinza-claro (papel ciclorama sem dobras " +
      "visíveis), duas softboxes laterais criando luz suave e direcional, leve sombra de contato no " +
      "chão, sem props no cenário — clima de editorial de revista de moda",
    refs: [
      {
        label: "Padrão",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/generated/46a3fd7c-c311-45f9-932c-bf535228c9e9/58bf22ea-05db-4a26-98c5-3e0c294d5dfb.jpg",
      },
    ],
  },
  {
    id: "praia",
    label: "Praia",
    emoji: "🏖️",
    desc:
      "praia tropical, areia clara, mar ao fundo, luz natural de dia batendo no rosto e no corpo",
    refs: [
      {
        label: "Opção 1",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/praia.jpg",
      },
      {
        label: "Opção 2",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/praia1.jpg",
      },
    ],
  },
  {
    id: "urbano",
    label: "Urbano",
    emoji: "🏙️",
    desc: "rua/calçada urbana contemporânea, prédios ao fundo, ambiente de cidade",
    refs: [
      {
        label: "Urbano",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/urbano.jpg",
      },
      {
        label: "Futurista",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/urbano-futurista.jpg",
      },
    ],
  },
  {
    id: "natureza",
    label: "Natureza",
    emoji: "🌳",
    desc: "área verde/parque arborizado, luz natural filtrada pelas folhas",
    refs: [
      {
        label: "Opção 1",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/natureza.jpg",
      },
      {
        label: "Opção 2",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/natureza1.jpg",
      },
    ],
  },
  {
    id: "trabalho",
    label: "Trabalho",
    emoji: "💼",
    desc: "escritório/ambiente corporativo moderno e bem iluminado",
    refs: [
      {
        label: "Opção 1",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/trabalho.jpg",
      },
      {
        label: "Opção 2",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/trabalho1.jpg",
      },
    ],
  },
  {
    id: "casamento",
    label: "Evento",
    emoji: "🥂",
    desc: "salão/ambiente de evento elegante e sofisticado",
    refs: [
      {
        label: "Opção 1",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/evento.jpg",
      },
      {
        label: "Opção 2",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/evento-.jpg",
      },
      {
        label: "Opção 3",
        url: "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/catalog/1f9b0063-aad4-47ce-8501-d3cd2bb51976/presets-backgrounds/evento1.jpg",
      },
    ],
  },
];
