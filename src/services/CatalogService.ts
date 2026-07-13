// CatalogService — catálogo de peças da loja (tabela catalog_items).
//
// Peças que a loja cadastra e vende; o Provador escolhe uma peça daqui.
// RLS isola por loja. Carregamento sob demanda na tela. Enquanto a migration
// 0004 não roda (ou catálogo vazio), cai no seed de `_temp` só para visualizar
// o layout — as mutações continuam funcionando localmente nesse modo.

import type { CatalogItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapCatalogItem } from "@/integrations/supabase/mappers";
import { StoreService } from "./StoreService";
import { seedCatalog } from "./_temp/seed";

export interface CatalogInput {
  name: string;
  category?: string | null;
  price?: number | null;
  imageUrl?: string | null;
  description?: string | null;
  sku?: string | null;
  active?: boolean;
}

let cache: CatalogItem[] = [];
let loaded = false;

function localItem(input: CatalogInput): CatalogItem {
  return {
    id: `c_${Date.now()}`,
    storeId: StoreService.get().id,
    name: input.name.trim(),
    category: input.category || undefined,
    price: input.price ?? undefined,
    imageUrl: input.imageUrl || undefined,
    description: input.description || undefined,
    sku: input.sku || undefined,
    active: input.active ?? true,
    createdAt: new Date().toISOString(),
  };
}

export const CatalogService = {
  list(): CatalogItem[] {
    return cache;
  },

  // Só peças ativas — usado pelo Provador.
  listActive(): CatalogItem[] {
    return cache.filter((c) => c.active);
  },

  find(id: string): CatalogItem | undefined {
    return cache.find((c) => c.id === id);
  },

  search(query: string): CatalogItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return cache;
    return cache.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.sku?.toLowerCase().includes(q) ?? false),
    );
  },

  async load(): Promise<CatalogItem[]> {
    try {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      cache = (data ?? []).map(mapCatalogItem);
      // TEMPORÁRIO: fallback de visualização quando ainda não há peças reais.
      if (cache.length === 0) cache = [...seedCatalog];
    } catch {
      // Tabela ainda não existe (migration 0004 não rodou) — usa o seed.
      cache = [...seedCatalog];
    }
    loaded = true;
    return cache;
  },

  async add(input: CatalogInput): Promise<CatalogItem> {
    const storeId = StoreService.get().id;
    try {
      const { data, error } = await supabase
        .from("catalog_items")
        .insert({
          store_id: storeId,
          name: input.name.trim(),
          category: input.category || null,
          price: input.price ?? null,
          image_url: input.imageUrl || null,
          description: input.description || null,
          sku: input.sku || null,
          active: input.active ?? true,
        })
        .select("*")
        .single();
      if (error) throw error;
      const item = mapCatalogItem(data);
      cache = [item, ...cache];
      return item;
    } catch {
      // Sem banco (pré-0004): mantém clicável atualizando só o cache local.
      const item = localItem(input);
      cache = [item, ...cache];
      return item;
    }
  },

  async update(id: string, patch: CatalogInput): Promise<CatalogItem> {
    const row = {
      name: patch.name.trim(),
      category: patch.category || null,
      price: patch.price ?? null,
      image_url: patch.imageUrl || null,
      description: patch.description || null,
      sku: patch.sku || null,
      active: patch.active ?? true,
    };
    try {
      const { data, error } = await supabase
        .from("catalog_items")
        .update(row)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      const item = data ? mapCatalogItem(data) : mergeLocal(cache, id, patch);
      cache = cache.map((c) => (c.id === id ? item : c));
      return item;
    } catch {
      const item = mergeLocal(cache, id, patch);
      cache = cache.map((c) => (c.id === id ? item : c));
      return item;
    }
  },

  async remove(id: string): Promise<void> {
    try {
      await supabase.from("catalog_items").delete().eq("id", id);
    } catch {
      // ignora — remove do cache de qualquer forma (item de seed/local).
    }
    cache = cache.filter((c) => c.id !== id);
  },

  reset(): void {
    cache = [];
    loaded = false;
  },

  isLoaded(): boolean {
    return loaded;
  },
};

function mergeLocal(list: CatalogItem[], id: string, patch: CatalogInput): CatalogItem {
  const current = list.find((c) => c.id === id);
  return {
    id,
    storeId: current?.storeId ?? StoreService.get().id,
    name: patch.name.trim(),
    category: patch.category || undefined,
    price: patch.price ?? undefined,
    imageUrl: patch.imageUrl || undefined,
    description: patch.description || undefined,
    sku: patch.sku || undefined,
    active: patch.active ?? true,
    createdAt: current?.createdAt ?? new Date().toISOString(),
  };
}
