// AuthService — autenticação real via Supabase Auth.
//
// A sessão de domínio (Session = { user, store }) é montada a partir do usuário
// do Auth + a linha em public.users + a loja. O AuthService orquestra a
// hidratação dos caches de Store/User/Token para que a UI continue lendo de
// forma síncrona (StoreService.get(), UserService.list(), TokenService...).

import type { Session, StoreSegment } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapUser } from "@/integrations/supabase/mappers";
import { StoreService } from "./StoreService";
import { UserService } from "./UserService";
import { TokenService } from "./TokenService";
import { InviteService } from "./InviteService";
import { ClientService } from "./ClientService";
import { GenerationService } from "./GenerationService";
import { AssetService } from "./AssetService";

// Limpa todos os caches em memória da loja (logout / sessão ausente).
function resetStoreCaches(): void {
  StoreService.reset();
  UserService.reset();
  TokenService.reset();
  InviteService.reset();
  ClientService.reset();
  GenerationService.reset();
  AssetService.reset();
}

let sessionCache: Session | null = null;

// Monta a Session do usuário autenticado e hidrata todos os caches.
async function buildSession(): Promise<Session | null> {
  const {
    data: { session: authSession },
  } = await supabase.auth.getSession();

  const authUser = authSession?.user;
  if (!authUser) {
    sessionCache = null;
    resetStoreCaches();
    return null;
  }

  // Linha de aplicação do próprio usuário.
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (userErr) throw userErr;
  if (!userRow) {
    // Sessão de auth sem perfil (ex.: trigger ainda não rodou). Sem loja.
    sessionCache = null;
    return null;
  }

  const store = await StoreService.getCurrentStore();
  // Hidrata listas/extrato da loja. GenerationService.load não lança (cai no
  // seed se a tabela não existir), por isso é seguro no Promise.all.
  await Promise.all([
    UserService.load(store.id),
    TokenService.load(store.id),
    GenerationService.load(),
    AssetService.load(store.id),
  ]);

  sessionCache = { user: mapUser(userRow), store };
  return sessionCache;
}

export const AuthService = {
  // Leitura síncrona do cache de sessão.
  getSession(): Session | null {
    return sessionCache;
  },

  // Carrega/atualiza a sessão a partir do Supabase (usado no bootstrap).
  async loadSession(): Promise<Session | null> {
    return buildSession();
  },

  async signIn(email: string, password: string): Promise<Session> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    const session = await buildSession();
    if (!session) throw new Error("Sessão indisponível após login.");
    return session;
  },

  // Cadastro: store_name e cnpj viajam em options.data e são lidos pelo trigger
  // handle_new_user (que cria a loja e o usuário owner). Pode retornar null se o
  // projeto exigir confirmação de e-mail (sem sessão imediata).
  async signUp(params: {
    storeName: string;
    ownerName?: string;
    email: string;
    password: string;
    cnpj?: string;
    segment?: StoreSegment;
  }): Promise<Session | null> {
    const { error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          store_name: params.storeName,
          // Lido pelo trigger handle_new_user → public.users.name (migration 0002).
          owner_name: params.ownerName ?? null,
          cnpj: params.cnpj ?? null,
          // Direcionamento da loja → stores.segment (migrations 0006/0007).
          segment: params.segment ?? "feminina",
        },
      },
    });
    if (error) throw error;
    return buildSession();
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    sessionCache = null;
    resetStoreCaches();
  },

  // Repassa eventos de auth do Supabase, reconstruindo a Session de domínio.
  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void buildSession().then(callback);
    });
    return () => subscription.unsubscribe();
  },

  // Envia o e-mail de recuperação. O link volta para /reset-password, onde o
  // usuário define a nova senha.
  async requestPasswordReset(email: string): Promise<void> {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  // Define a nova senha (usado na página /reset-password, com a sessão de
  // recuperação já ativa via link do e-mail).
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
};
