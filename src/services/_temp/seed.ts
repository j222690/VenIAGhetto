// TEMPORÁRIO — substituir por Supabase / Edge Functions.
// Todo dado mock vive aqui. Nenhum componente importa deste arquivo diretamente;
// apenas os services em src/services/* leem este módulo.

import type {
  Asset,
  CatalogItem,
  Generation,
  GenerationType,
  ProductSheet,
  Session,
  SocialCopySet,
  Store,
  TokenTransaction,
  User,
} from "@/types";

const STORE_ID = "store_demo";

export const seedStore: Store = {
  id: STORE_ID,
  name: "Atelier Demo",
  cnpj: "00.000.000/0001-00",
  logoUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=200&q=80",
  description:
    "Moda autoral atemporal — peças em tecidos naturais com caimento impecável. Curadoria que valoriza o essencial.",
  location: "Rua Oscar Freire, 1200 — Jardins, São Paulo / SP",
  instagram: "@atelierdemo",
  contactEmail: "contato@atelierdemo.com",
  contactPhone: "(11) 99999-0000",
  planId: "pro",
  tokensBalance: 487,
  tokensUsedThisMonth: 113,
};

export const seedUsers: User[] = [
  {
    id: "user_owner",
    storeId: STORE_ID,
    name: "Marina Souza",
    email: "marina@atelierdemo.com",
    role: "owner",
  },
  {
    id: "user_manager",
    storeId: STORE_ID,
    name: "Rafael Lima",
    email: "rafael@atelierdemo.com",
    role: "manager",
  },
  {
    id: "user_seller",
    storeId: STORE_ID,
    name: "Júlia Pereira",
    email: "julia@atelierdemo.com",
    role: "seller",
  },
];

export const seedSession: Session = {
  user: seedUsers[0],
  store: seedStore,
};

// Demo image (Unsplash) — apenas para preencher UI até integrar Imagen.
const demoImg = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=900&q=80`;

export const seedAssets: Asset[] = [
  {
    id: "a1",
    storeId: STORE_ID,
    category: "model",
    name: "Modelo · Editorial 01",
    url: demoImg("1521146764736-56c929d59c83"),
    createdAt: new Date().toISOString(),
  },
  {
    id: "a2",
    storeId: STORE_ID,
    category: "model",
    name: "Modelo · Studio 02",
    url: demoImg("1494790108377-be9c29b29330"),
    createdAt: new Date().toISOString(),
  },
  {
    id: "a3",
    storeId: STORE_ID,
    category: "look",
    name: "Vestido midi linho",
    url: demoImg("1483985988355-763728e1935b"),
    createdAt: new Date().toISOString(),
  },
  {
    id: "a4",
    storeId: STORE_ID,
    category: "look",
    name: "Conjunto alfaiataria",
    url: demoImg("1490481651871-ab68de25d43d"),
    createdAt: new Date().toISOString(),
  },
  {
    id: "a5",
    storeId: STORE_ID,
    category: "background",
    name: "Fundo · Pedra travertino",
    url: demoImg("1519681393784-d120267933ba"),
    createdAt: new Date().toISOString(),
  },
  {
    id: "a6",
    storeId: STORE_ID,
    category: "generated",
    name: "Look terracota · ensaio",
    url: demoImg("1469334031218-e382a71b716b"),
    createdAt: new Date().toISOString(),
  },
];

const hoursAgo = (h: number) =>
  new Date(Date.now() - 1000 * 60 * 60 * h).toISOString();

export const seedGenerations: Generation[] = [
  {
    id: "g1",
    storeId: STORE_ID,
    userId: "user_owner",
    type: "tryon",
    inputs: { modelAssetId: "a1", lookAssetId: "a3", modelGender: "female" },
    resultUrl: demoImg("1469334031218-e382a71b716b"),
    tokensCost: 3,
    isFavorite: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "g2",
    storeId: STORE_ID,
    userId: "user_manager",
    type: "post",
    inputs: { modelAssetId: "a2", lookAssetId: "a4" },
    resultUrl: demoImg("1485518882345-15568b007407"),
    tokensCost: 5,
    isFavorite: false,
    copies: {
      instagram:
        "Alfaiataria que conversa com o agora. Conjunto em linho leve para os dias que pedem presença. ✨",
      whatsapp:
        "Oi! Chegou um conjunto novo que combina com você. Quer ver o vídeo da peça?",
      facebook:
        "Novidade na loja: alfaiataria em linho com caimento impecável. Vem conferir!",
      hashtags: ["#moda", "#alfaiataria", "#looktrabalho", "#styledesk"],
      cta: "Garanta o seu — link na bio",
    },
    createdAt: hoursAgo(3),
  },
  {
    id: "g3",
    storeId: STORE_ID,
    userId: "user_owner",
    type: "scanner",
    inputs: {},
    resultUrl: demoImg("1542060748-10c28b62716f"),
    tokensCost: 1,
    isFavorite: false,
    createdAt: hoursAgo(26),
  },
  {
    id: "g4",
    storeId: STORE_ID,
    userId: "user_seller",
    type: "tryon",
    inputs: { modelAssetId: "a2", lookAssetId: "a4", modelGender: "female" },
    resultUrl: demoImg("1515886657613-9f3515b0c78f"),
    tokensCost: 3,
    isFavorite: true,
    createdAt: hoursAgo(48),
  },
  {
    id: "g5",
    storeId: STORE_ID,
    userId: "user_owner",
    type: "tryon",
    inputs: { modelAssetId: "a1", lookAssetId: "a3", modelGender: "female" },
    resultUrl: demoImg("1483985988355-763728e1935b"),
    tokensCost: 3,
    isFavorite: false,
    createdAt: hoursAgo(72),
  },
  {
    id: "g6",
    storeId: STORE_ID,
    userId: "user_manager",
    type: "post",
    inputs: { modelAssetId: "a2", lookAssetId: "a4" },
    resultUrl: demoImg("1490481651871-ab68de25d43d"),
    tokensCost: 5,
    isFavorite: false,
    createdAt: hoursAgo(96),
  },
  {
    id: "g7",
    storeId: STORE_ID,
    userId: "user_seller",
    type: "tryon",
    inputs: { modelAssetId: "a1", lookAssetId: "a3", modelGender: "male" },
    resultUrl: demoImg("1490578474895-699cd4e2cf59"),
    tokensCost: 3,
    isFavorite: true,
    createdAt: hoursAgo(120),
  },
  {
    id: "g8",
    storeId: STORE_ID,
    userId: "user_owner",
    type: "post",
    inputs: { modelAssetId: "a2", lookAssetId: "a4" },
    resultUrl: demoImg("1487412720507-e7ab37603c6f"),
    tokensCost: 5,
    isFavorite: false,
    createdAt: hoursAgo(150),
  },
];

export const seedTransactions: TokenTransaction[] = [
  {
    id: "t1",
    storeId: STORE_ID,
    amount: 600,
    reason: "Renovação plano Pro",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
  },
  {
    id: "t2",
    storeId: STORE_ID,
    amount: -113,
    reason: "Consumo do mês",
    createdAt: new Date().toISOString(),
  },
];

export const seedProductSheet = (sourceImageUrl: string): ProductSheet => ({
  id: `p_${Date.now()}`,
  sourceImageUrl,
  name: "Vestido midi em linho",
  colors: ["Terracota", "Off-white"],
  fabric: "Linho 100%",
  style: "Minimalista contemporâneo",
  occasion: "Dia a dia, brunch, eventos diurnos",
  suggestedPriceBRL: 389,
  tags: ["linho", "midi", "verão", "minimal", "terracota"],
  sizes: ["PP", "P", "M", "G", "GG"],
  seoTitle: "Vestido Midi Linho Terracota — Coleção StyleDesk",
  shortDescription:
    "Vestido midi em linho leve, caimento fluido e cor terracota sofisticada.",
  longDescription:
    "Confeccionado em linho puro, o vestido midi traz silhueta solta com cintura marcada por amarração discreta. O tom terracota imprime sofisticação atemporal — perfeito para compor looks dia a noite com sandálias planas ou saltos.",
  category: "Vestidos",
});

export const TEMP_STORE_ID = STORE_ID;

// ---------------------------------------------------------------------------
// TEMPORÁRIO: imagem de RESULTADO da geração. Enquanto a IA (Gemini/Imagen)
// não está integrada, o GenerationService usa esta imagem de exemplo como
// "resultado". Trocar pela imagem real retornada pela IA.
// ---------------------------------------------------------------------------
const PLACEHOLDER_RESULTS: Record<GenerationType, string> = {
  tryon: demoImg("1469334031218-e382a71b716b"),
  post: demoImg("1485518882345-15568b007407"),
  scanner: demoImg("1542060748-10c28b62716f"),
};

export const placeholderResult = (type: GenerationType): string =>
  PLACEHOLDER_RESULTS[type];

// TEMPORÁRIO: copys de exemplo p/ o Criador de Posts (substituir por IA).
export const seedSocialCopy: SocialCopySet = {
  instagram:
    "Para quem entende que estilo é coerência. Look novo, atemporal, pronto para você. ✨",
  whatsapp: "Oi! Acabou de chegar uma peça que vai com tudo no seu guarda-roupa. Quer ver?",
  facebook: "Novidade fresca na loja — vem dar uma olhada nessa peça incrível!",
  hashtags: ["#moda", "#styledesk", "#tendencia", "#looknovo"],
  cta: "Compre agora · link na bio",
};

// TEMPORÁRIO: fotos de cliente de exemplo p/ o Provador (substituir por upload
// real via Storage). São só placeholders para escolher no fluxo.
export const seedClientPhotos: { id: string; url: string }[] = [
  { id: "ph1", url: demoImg("1521146764736-56c929d59c83") },
  { id: "ph2", url: demoImg("1494790108377-be9c29b29330") },
  { id: "ph3", url: demoImg("1500648767791-00dcc994a43e") },
  { id: "ph4", url: demoImg("1534528741775-53994a69daeb") },
];

// TEMPORÁRIO: catálogo de exemplo p/ visualizar a tela. O CatalogService usa
// isto como fallback quando o banco está vazio / a migration 0004 não rodou.
export const seedCatalog: CatalogItem[] = [
  {
    id: "c1",
    storeId: STORE_ID,
    name: "Vestido midi linho",
    category: "Vestidos",
    price: 389,
    imageUrl: demoImg("1483985988355-763728e1935b"),
    description: "Linho leve, caimento fluido, tom terracota.",
    sku: "VST-001",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "c2",
    storeId: STORE_ID,
    name: "Conjunto alfaiataria",
    category: "Conjuntos",
    price: 549,
    imageUrl: demoImg("1490481651871-ab68de25d43d"),
    description: "Blazer + calça em linho, caimento impecável.",
    sku: "CNJ-002",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "c3",
    storeId: STORE_ID,
    name: "Camisa seda off-white",
    category: "Camisas",
    price: 259,
    imageUrl: demoImg("1564257631407-4deb1f99d992"),
    description: "Seda com toque fluido, versátil dia a noite.",
    sku: "CAM-003",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "c4",
    storeId: STORE_ID,
    name: "Calça pantalona",
    category: "Calças",
    price: 329,
    imageUrl: demoImg("1490578474895-699cd4e2cf59"),
    description: "Cintura alta, caimento amplo e elegante.",
    sku: "CAL-004",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "c5",
    storeId: STORE_ID,
    name: "Saia midi plissada",
    category: "Saias",
    price: 279,
    imageUrl: demoImg("1487412720507-e7ab37603c6f"),
    description: "Plissado fluido, movimento e sofisticação.",
    sku: "SAI-005",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "c6",
    storeId: STORE_ID,
    name: "Blazer estruturado",
    category: "Casacos",
    price: 459,
    imageUrl: demoImg("1591047139829-d91aecb6caea"),
    description: "Alfaiataria contemporânea, ombro marcado.",
    sku: "BLZ-006",
    active: false,
    createdAt: new Date().toISOString(),
  },
];
