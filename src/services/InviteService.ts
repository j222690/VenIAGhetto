// InviteService — convites de funcionário (tabela store_invites).
//
// Convidar NÃO cria um usuário: cria um registro `pending`. O convidado só vira
// membro da equipe quando se cadastrar com aquele e-mail — aí o trigger
// handle_new_user (migration 0003) o liga à loja e marca o convite `accepted`.
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
