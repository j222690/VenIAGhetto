// AdminService — painel de uso da plataforma inteira (todas as lojas). Só
// funciona pra contas na lista ADMIN_EMAILS (secret da Edge Function
// admin-stats) — qualquer outra conta recebe 403. O gate no frontend
// (mostrar ou não o botão) é só UX; a permissão de verdade é no servidor.

import { supabase } from "@/integrations/supabase/client";

export interface PlatformStats {
  totalStores: number;
  totalUsers: number;
  newStoresLast7Days: number;
  generationsByType: { tryon: number; post: number; scanner: number };
  totalGenerations: number;
  tokensConsumed: number;
  note: string;
}

export const AdminService = {
  async platformStats(): Promise<PlatformStats> {
    const { data, error } = await supabase.functions.invoke("admin-stats");
    if (error) throw new Error("Não foi possível carregar as métricas.");
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as PlatformStats;
  },
};
