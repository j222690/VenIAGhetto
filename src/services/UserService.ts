// UserService — EQUIPE (staff): membros da loja que fazem login (tabela users,
// ligada a auth.users). Papéis: owner (criou a loja) / manager / seller.
//
// NÃO confundir com clientes (ClientService) — clientes não fazem login.
// Para ADICIONAR um membro novo use InviteService (convite) — um usuário só
// entra na `users` ao se cadastrar com o e-mail convidado (trigger 0003).
// Aqui ficam apenas as operações sobre quem JÁ é membro: listar, mudar papel,
// remover.
//
// `list()` é síncrono (a UI já o usa assim) e lê de um cache em memória que é
// hidratado por `load()` durante o bootstrap da sessão.

import type { User, UserRole } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapUser } from "@/integrations/supabase/mappers";

let cache: User[] = [];

export const UserService = {
  // Leitura síncrona do cache — usada pela UI.
  list(): User[] {
    return cache;
  },

  // Carrega os usuários da loja. A RLS `users_select_same_store` já restringe
  // o retorno à loja do usuário logado.
  async load(storeId?: string): Promise<User[]> {
    let query = supabase.from("users").select("*").order("created_at");
    if (storeId) query = query.eq("store_id", storeId);

    const { data, error } = await query;
    if (error) throw error;

    cache = (data ?? []).map(mapUser);
    return cache;
  },

  // Atualiza o papel de um usuário da loja (RLS exige owner/manager).
  async updateRole(id: string, role: UserRole): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({ role })
      .eq("id", id);
    if (error) throw error;
    cache = cache.map((u) => (u.id === id ? { ...u, role } : u));
  },

  // Remove um usuário da loja (RLS exige owner/manager).
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw error;
    cache = cache.filter((u) => u.id !== id);
  },

  reset(): void {
    cache = [];
  },
};
