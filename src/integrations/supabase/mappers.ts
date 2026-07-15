// Conversão de linhas do banco (snake_case) para os tipos de domínio
// (camelCase) usados pela UI. Mantém a UI desacoplada do schema do Supabase.

import type {
  Asset,
  CatalogItem,
  Client,
  Generation,
  Store,
  StoreInvite,
  TokenTransaction,
  User,
} from "@/types";
import type {
  AssetRow,
  CatalogItemRow,
  ClientRow,
  GenerationRow,
  StoreInviteRow,
  StoreRow,
  TokenTransactionRow,
  UserRow,
} from "./types";

// A tabela `users` não guarda um campo "name". Derivamos um nome de exibição a
// partir do e-mail para preencher a UI (avatar/iniciais) sem alterar telas.
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const words = local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return email;
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    storeId: row.store_id,
    category: row.type,
    name: row.name?.trim() || "Sem nome",
    url: row.url,
    createdAt: row.created_at,
  };
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    storeId: row.store_id,
    // Nome real (coluna `name`); fallback ao derivado do e-mail p/ linhas antigas.
    name: row.name?.trim() || displayNameFromEmail(row.email),
    email: row.email,
    role: row.role,
  };
}

// `tokensUsedThisMonth` não tem coluna própria — é calculado a partir do
// extrato (token_transactions). O TokenService preenche esse valor ao carregar.
export function mapStore(row: StoreRow, tokensUsedThisMonth = 0): Store {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    instagram: row.instagram ?? undefined,
    contactEmail: row.email ?? undefined,
    contactPhone: row.phone ?? undefined,
    planId: row.plan,
    segment: row.segment ?? "feminina",
    tokensBalance: row.tokens_balance,
    tokensUsedThisMonth,
  };
}

// generation_type no banco usa "provador"; no domínio usamos "tryon".
const GENERATION_TYPE_FROM_DB = {
  provador: "tryon",
  post: "post",
  scanner: "scanner",
} as const;

export function mapGeneration(row: GenerationRow): Generation {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id ?? "",
    type: GENERATION_TYPE_FROM_DB[row.type],
    inputs: (row.input_refs as Generation["inputs"]) ?? {},
    resultUrl: row.output_url ?? "",
    copies: (row.copies as unknown as Generation["copies"]) ?? undefined,
    tokensCost: row.tokens_used,
    isFavorite: row.is_favorite,
    clientId: row.client_id ?? undefined,
    createdAt: row.created_at,
  };
}

// Domínio → banco (inverso de GENERATION_TYPE_FROM_DB).
export const GENERATION_TYPE_TO_DB = {
  tryon: "provador",
  post: "post",
  scanner: "scanner",
} as const;

export function mapCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    category: row.category ?? undefined,
    price: row.price ?? undefined,
    imageUrl: row.image_url ?? undefined,
    cleanImageUrl: row.clean_image_url ?? undefined,
    description: row.description ?? undefined,
    sku: row.sku ?? undefined,
    active: row.active,
    createdAt: row.created_at,
  };
}

export function mapInvite(row: StoreInviteRow): StoreInvite {
  return {
    id: row.id,
    storeId: row.store_id,
    email: row.email ?? undefined,
    token: row.token,
    role: row.role,
    invitedBy: row.invited_by ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? undefined,
  };
}

export function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    instagram: row.instagram ?? undefined,
    phone: row.phone ?? undefined,
    notes: row.notes ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapTransaction(row: TokenTransactionRow): TokenTransaction {
  // No banco `amount` é sempre positivo + um `type` (credit/debit).
  // No domínio, débito é representado por valor negativo.
  const signed = row.type === "debit" ? -Math.abs(row.amount) : Math.abs(row.amount);
  return {
    id: row.id,
    storeId: row.store_id,
    amount: signed,
    reason: row.ref_id ? `ref:${row.ref_id}` : row.type === "debit" ? "Débito" : "Crédito",
    createdAt: row.created_at,
  };
}
