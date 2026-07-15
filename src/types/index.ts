// Domain types for Vest IA.
// Reused across services, hooks and components. Never use `any`.

export type UserRole = "owner" | "manager" | "seller";

// Equipe (staff): pessoas que fazem login e usam o app (ligadas a auth.users).
export interface User {
  id: string;
  storeId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export type InviteStatus = "pending" | "accepted" | "revoked";

// Convite de funcionário: o convidado vira `User` ao se cadastrar com o
// e-mail convidado, OU ao entrar pelo link do convite (`token`) — ver 0003 e
// 0015 (handle_new_user checa o token primeiro, depois o e-mail).
export interface StoreInvite {
  id: string;
  storeId: string;
  email?: string;
  token: string;
  role: UserRole;
  invitedBy?: string;
  status: InviteStatus;
  createdAt: string;
  acceptedAt?: string;
}

// Cliente (CRM): pessoa que a loja ATENDE e NÃO faz login. Sem ligação com auth.
export interface Client {
  id: string;
  storeId: string;
  name: string;
  instagram?: string;
  phone?: string;
  notes?: string;
  // Foto BASE do cliente (bucket `clients`) — pré-preenche o Provador.
  photoUrl?: string;
  createdAt: string;
}

export type PlanId = "starter" | "pro" | "business";

// Segmento da loja — define o esquema de cores neon do app.
// feminina = rosa/roxo · masculina = azul/verde · unissex (os dois) = roxo/azul.
export type StoreSegment = "feminina" | "masculina" | "unissex";

export interface Plan {
  id: PlanId;
  name: string;
  priceBRL: number;
  tokens: number;
  features: string[];
  maxUsers: number | "unlimited";
  librarySize: number | "unlimited";
  historyDays: number | "unlimited";
}

export interface Store {
  id: string;
  name: string;
  cnpj?: string;
  logoUrl?: string;
  description?: string;
  location?: string;
  instagram?: string;
  contactEmail?: string;
  contactPhone?: string;
  planId: PlanId;
  segment: StoreSegment;
  tokensBalance: number;
  tokensUsedThisMonth: number;
}

export type AssetCategory = "model" | "look" | "background" | "generated";

export interface Asset {
  id: string;
  storeId: string;
  category: AssetCategory;
  name: string;
  url: string;
  createdAt: string;
  tags?: string[];
}

export type GenerationType = "tryon" | "post" | "scanner";

export interface GenerationInputs {
  modelAssetId?: string;
  lookAssetId?: string;
  catalogItemId?: string;
  clientPhotoUrl?: string;
  modelGender?: "male" | "female";
  notes?: string;
}

export interface Generation {
  id: string;
  storeId: string;
  userId: string;
  type: GenerationType;
  inputs: GenerationInputs;
  resultUrl: string;
  copies?: SocialCopySet;
  tokensCost: number;
  isFavorite: boolean;
  clientId?: string;
  createdAt: string;
}

// Peça do catálogo da loja (a loja cadastra o que vende).
export interface CatalogItem {
  id: string;
  storeId: string;
  name: string;
  category?: string;
  price?: number;
  imageUrl?: string;
  // Versão isolada da foto (peça sozinha, sem fundo/modelo) — gerada por IA,
  // ação manual e opcional do lojista ("Limpar peça"). Usada de preferência
  // no Provador quando disponível.
  cleanImageUrl?: string;
  description?: string;
  sku?: string;
  active: boolean;
  createdAt: string;
}

export interface SocialCopySet {
  instagram: string;
  whatsapp: string;
  facebook: string;
  hashtags: string[];
  cta: string;
}

export interface ProductSheet {
  id: string;
  sourceImageUrl: string;
  name: string;
  colors: string[];
  fabric: string;
  style: string;
  occasion: string;
  suggestedPriceBRL: number;
  tags: string[];
  sizes: string[];
  seoTitle: string;
  shortDescription: string;
  longDescription: string;
  category: string;
}

export interface TokenTransaction {
  id: string;
  storeId: string;
  amount: number; // negative = debit, positive = credit
  reason: string;
  createdAt: string;
}

export type Permission =
  | "generate"
  | "library:access"
  | "users:manage"
  | "store:manage"
  | "catalog:manage"
  | "tokens:view"
  | "plan:change"
  | "reports:view"
  | "clients:delete";

export interface Session {
  user: User;
  store: Store;
}
