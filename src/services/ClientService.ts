// ClientService — clientes da loja (CRM simples, tabela clients).
//
// Cliente é pessoa que a loja ATENDE e NÃO faz login (sem ligação com auth).
// RLS isola por loja; toda a equipe da loja (qualquer papel) administra. O
// carregamento é sob demanda na tela.

import type { Client, Generation } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapClient } from "@/integrations/supabase/mappers";
import { StoreService } from "./StoreService";
import { GenerationService } from "./GenerationService";

export interface ClientInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

let cache: Client[] = [];

export const ClientService = {
  // Leitura síncrona do cache.
  list(): Client[] {
    return cache;
  },

  find(id: string): Client | undefined {
    return cache.find((c) => c.id === id);
  },

  // Busca local por nome (sobre o cache já carregado).
  search(query: string): Client[] {
    const q = query.trim().toLowerCase();
    if (!q) return cache;
    return cache.filter((c) => c.name.toLowerCase().includes(q));
  },

  async load(): Promise<Client[]> {
    const { data, error } = await supabase.from("clients").select("*").order("name");
    if (error) throw error;
    cache = (data ?? []).map(mapClient);
    return cache;
  },

  async addClient(input: ClientInput): Promise<Client> {
    const storeId = StoreService.get().id;
    if (!storeId) throw new Error("Nenhuma loja carregada.");

    const { data, error } = await supabase
      .from("clients")
      .insert({
        store_id: storeId,
        name: input.name.trim(),
        email: input.email || null,
        phone: input.phone || null,
        notes: input.notes || null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const client = mapClient(data);
    cache = [...cache, client].sort((a, b) => a.name.localeCompare(b.name));
    return client;
  },

  async updateClient(id: string, patch: ClientInput): Promise<Client> {
    const { data, error } = await supabase
      .from("clients")
      .update({
        name: patch.name.trim(),
        email: patch.email || null,
        phone: patch.phone || null,
        notes: patch.notes || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    const client = mapClient(data);
    cache = cache
      .map((c) => (c.id === id ? client : c))
      .sort((a, b) => a.name.localeCompare(b.name));
    return client;
  },

  // Pasta do cliente: todas as imagens geradas para ele (busca real em
  // generations por client_id, sob o RLS por loja). Delega ao GenerationService,
  // dono da tabela `generations`.
  listClientGenerations(clientId: string): Promise<Generation[]> {
    return GenerationService.listByClient(clientId);
  },

  async removeClient(id: string): Promise<void> {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
    cache = cache.filter((c) => c.id !== id);
  },

  reset(): void {
    cache = [];
  },
};
