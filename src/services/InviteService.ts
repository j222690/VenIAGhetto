// InviteService — convites de funcionário (tabela store_invites).
//
// Convidar NÃO cria um usuário: cria um registro `pending`. Dois modos:
//   • Por E-MAIL: só aquele e-mail aceita (createInvite).
//   • Por LINK: qualquer pessoa que abrir o link e se cadastrar entra na loja
//     (createLinkInvite) — pensado para mandar por WhatsApp/Instagram.
// Em ambos, o trigger handle_new_user (migrations 0003/0015) liga o novo
// usuário à loja e marca o convite `accepted`.
//
// RLS restringe tudo a owner/manager da própria loja. Carregamento é sob
// demanda na tela (não no bootstrap), para que o login funcione mesmo antes de
// a migration 0003 ter sido aplicada.

import type { StoreInvite, UserRole } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapInvite } from "@/integrations/supabase/mappers";
import { StoreService } from "./StoreService";

let cache: StoreInvite[] = [];

export const InviteService = {
  // Leitura síncrona do cache (convites pendentes da loja).
  list(): StoreInvite[] {
    return cache;
  },

  // Carrega os convites pendentes da loja. RLS já restringe a owner/manager;
  // para um seller o retorno é vazio (sem erro).
  async load(): Promise<StoreInvite[]> {
    const { data, error } = await supabase
      .from("store_invites")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    cache = (data ?? []).map(mapInvite);
    return cache;
  },

  // Cria um convite pendente (e-mail normalizado em minúsculas).
  async createInvite(email: string, role: UserRole): Promise<StoreInvite> {
    const storeId = StoreService.get().id;
    if (!storeId) throw new Error("Nenhuma loja carregada.");

    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("store_invites")
      .insert({
        store_id: storeId,
        email: email.trim().toLowerCase(),
        role,
        invited_by: auth.user?.id ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;

    const invite = mapInvite(data);
    cache = [invite, ...cache];
    return invite;
  },

  // Cria um convite por LINK (sem e-mail definido) — qualquer pessoa que se
  // cadastrar pelo link (/register?invite=<token>) entra na loja com este papel.
  async createLinkInvite(role: UserRole): Promise<StoreInvite> {
    const storeId = StoreService.get().id;
    if (!storeId) throw new Error("Nenhuma loja carregada.");

    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("store_invites")
      .insert({
        store_id: storeId,
        email: null,
        role,
        invited_by: auth.user?.id ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;

    const invite = mapInvite(data);
    cache = [invite, ...cache];
    return invite;
  },

  // Dispara o e-mail de notificação pro convidado (Edge Function `send-invite-
  // email` via Resend). Lança em falha — quem chama decide o aviso na tela; o
  // convite em si já foi criado antes e continua válido mesmo se o e-mail falhar.
  async sendInviteEmail(invite: StoreInvite): Promise<void> {
    const { error } = await supabase.functions.invoke("send-invite-email", {
      body: { inviteId: invite.id },
    });
    if (error) throw error;
  },

  // URL completa do convite por link, pronta para compartilhar.
  linkFor(invite: StoreInvite): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/register?invite=${invite.token}`;
  },

  // Preview público (RPC get_invite_by_token, migration 0015) — usado na tela
  // de cadastro para mostrar de qual loja veio o convite antes do login.
  async previewByToken(token: string): Promise<{ storeName: string; role: UserRole } | null> {
    const { data, error } = await supabase.rpc("get_invite_by_token", { p_token: token });
    if (error || !data || data.length === 0) return null;
    const row = data[0];
    return { storeName: row.store_name, role: row.role };
  },

  // Revoga (marca como revoked) um convite pendente.
  async revokeInvite(id: string): Promise<void> {
    const { error } = await supabase
      .from("store_invites")
      .update({ status: "revoked" })
      .eq("id", id);
    if (error) throw error;
    cache = cache.filter((i) => i.id !== id);
  },

  reset(): void {
    cache = [];
  },
};
