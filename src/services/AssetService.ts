// AssetService — biblioteca de imagens da loja (tabela `assets`, RLS por loja).
//
// A UI lê de forma síncrona (`list()`); mantemos um cache em memória hidratado
// por `load()` no bootstrap da sessão e por `add`/`remove`. Persistência real no
// Supabase; em falha (offline/pré-migration) mantém o estado local.

import type { Asset, AssetCategory } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapAsset } from "@/integrations/supabase/mappers";
import { StoreService } from "./StoreService";

let assets: Asset[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const AssetService = {
  list(category?: AssetCategory): Asset[] {
    return category ? assets.filter((a) => a.category === category) : assets;
  },
  find(id: string): Asset | undefined {
    return assets.find((a) => a.id === id);
  },
  search(query: string): Asset[] {
    const q = query.toLowerCase();
    return assets.filter((a) => a.name.toLowerCase().includes(q));
  },

  // Carrega os ativos reais da loja (bootstrap da sessão). Não lança.
  async load(storeId?: string): Promise<Asset[]> {
    try {
      let q = supabase.from("assets").select("*").order("created_at", { ascending: false });
      if (storeId) q = q.eq("store_id", storeId);
      const { data, error } = await q;
      if (error) throw error;
      assets = (data ?? []).map(mapAsset);
    } catch {
      assets = [];
    }
    notify();
    return assets;
  },

  // Salva um ativo (ex.: look gerado, upload da biblioteca). Persiste e atualiza
  // o cache; em falha mantém um item local para a UI não travar.
  async add(asset: Omit<Asset, "id" | "createdAt">): Promise<Asset> {
    const storeId = asset.storeId || StoreService.get().id;
    try {
      const { data, error } = await supabase
        .from("assets")
        .insert({ store_id: storeId, type: asset.category, url: asset.url, name: asset.name })
        .select("*")
        .single();
      if (error) throw error;
      const created = mapAsset(data);
      assets = [created, ...assets];
      notify();
      return created;
    } catch {
      const created: Asset = { ...asset, id: `a_${Date.now()}`, createdAt: new Date().toISOString() };
      assets = [created, ...assets];
      notify();
      return created;
    }
  },

  async remove(ids: string[]): Promise<void> {
    assets = assets.filter((a) => !ids.includes(a.id));
    notify();
    try {
      await supabase.from("assets").delete().in("id", ids);
    } catch {
      // item local/pré-migration — segue só no cache.
    }
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  reset(): void {
    assets = [];
    notify();
  },
};
