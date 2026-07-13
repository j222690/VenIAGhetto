// StoreService — dados da loja (tenant) no Supabase, com RLS por loja.
//
// A UI consome a loja de forma síncrona (`StoreService.get()`), então mantemos
// um cache em memória hidratado pelas chamadas assíncronas (`getCurrentStore`,
// `updateStore`). O cache é a fonte síncrona; o Supabase é a fonte de verdade.

import type { Store } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { mapStore } from "@/integrations/supabase/mappers";

type StoreUpdate = Database["public"]["Tables"]["stores"]["Update"];

// Loja "vazia" enquanto o cache não foi hidratado (evita undefined na UI).
const EMPTY_STORE: Store = {
  id: "",
  name: "",
  planId: "starter",
  tokensBalance: 0,
  tokensUsedThisMonth: 0,
};

let cache: Store = EMPTY_STORE;

export const StoreService = {
  // Leitura síncrona do cache — usada pela UI/Context.
  get(): Store {
    return cache;
  },

  // Atualização local do cache (sem rede). Usada para sincronização otimista
  // (ex.: saldo de tokens). Não persiste no banco.
  update(patch: Partial<Store>): Store {
    cache = { ...cache, ...patch };
    return cache;
  },

  // Lê do Supabase a loja do usuário logado. A policy RLS `stores_select_own`
  // garante que só a própria loja é retornada.
  async getCurrentStore(): Promise<Store> {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      cache = EMPTY_STORE;
      return cache;
    }

    // Preserva o tokensUsedThisMonth já calculado pelo TokenService, se houver.
    cache = mapStore(data, cache.tokensUsedThisMonth);
    return cache;
  },

  // Persiste alterações da loja no banco (RLS `stores_update_own` — só a
  // própria loja; e a app restringe a edição a owner/manager via `store:manage`).
  // Aceita os campos do perfil público (ver migration 0002).
  async updateStore(patch: {
    name?: string;
    cnpj?: string | null;
    logoUrl?: string | null;
    description?: string | null;
    location?: string | null;
    instagram?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  }): Promise<Store> {
    if (!cache.id) throw new Error("Nenhuma loja carregada para atualizar.");

    // Mapeia camelCase (domínio) → snake_case (colunas). Só envia o que veio
    // no patch para não sobrescrever colunas com undefined.
    const row: StoreUpdate = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.cnpj !== undefined) row.cnpj = patch.cnpj;
    if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.location !== undefined) row.location = patch.location;
    if (patch.instagram !== undefined) row.instagram = patch.instagram;
    if (patch.contactEmail !== undefined) row.email = patch.contactEmail;
    if (patch.contactPhone !== undefined) row.phone = patch.contactPhone;

    const { data, error } = await supabase
      .from("stores")
      .update(row)
      .eq("id", cache.id)
      .select("*")
      .single();

    if (error) throw error;
    cache = mapStore(data, cache.tokensUsedThisMonth);
    return cache;
  },

  // Limpa o cache (usado no logout).
  reset(): void {
    cache = EMPTY_STORE;
  },
};
