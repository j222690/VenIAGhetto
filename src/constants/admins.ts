// Quem é DONO DO APP (não confundir com dono de loja).
//
// A regra é a loja da Vest Ai + papel de dono ou gerente. Vendedor da mesma
// loja é equipe da operação da loja, não sócio do app, e fica de fora.
//
// Isto aqui é só UX: serve para esconder o que a pessoa não pode usar. A
// permissão de verdade é do lado do servidor (secret ADMIN_STORE_ID na Edge
// Function admin-showcase) — mudar este arquivo no navegador não abre nada.

import type { Session } from "@/types";

export const APP_ADMIN_STORE_ID = "1f9b0063-aad4-47ce-8501-d3cd2bb51976";

const PAPEIS_ADMIN = ["owner", "manager"];

export const isAppAdmin = (session: Session | null | undefined): boolean =>
  !!session && session.store.id === APP_ADMIN_STORE_ID && PAPEIS_ADMIN.includes(session.user.role);
