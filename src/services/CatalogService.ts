// CatalogService — catálogo de peças da loja (tabela catalog_items).
//
// Peças que a loja cadastra e vende; o Provador escolhe uma peça daqui.
// RLS isola por loja. Carregamento sob demanda na tela. Enquanto a migration
// 0004 não roda (ou catálogo vazio), cai no seed de `_temp` só para visualizar
// o layout — as mutações continuam funcionando localmente nesse modo.

import type { CatalogItem, StoreSegment } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapCatalogItem } from "@/integrations/supabase/mappers";
import { AIService } from "./AIService";
import { StoreService } from "./StoreService";

export const CATALOG_CATEGORIES = [
  "Vestidos",
  "Conjuntos",
  "Camisas",
  "Calças",
  "Saias",
  "Casacos",
  "Acessórios",
] as const;

// Categorias exclusivamente femininas — escondidas quando a loja é "masculina"
// (o Direcionamento da loja, em Configurações, define o público das criações).
const FEMININE_ONLY_CATEGORIES: readonly string[] = ["Vestidos", "Saias"];

// Categorias visíveis no catálogo/filtro conforme o segmento da loja.
export function categoriesForSegment(segment: StoreSegment): readonly string[] {
  if (segment === "masculina") {
    return CATALOG_CATEGORIES.filter((c) => !FEMININE_ONLY_CATEGORIES.includes(c));
  }
  return CATALOG_CATEGORIES;
}

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
      // Reflete apenas as peças reais da loja (vazio até a loja cadastrar).
      cache = (data ?? []).map(mapCatalogItem);
    } catch {
      // Tabela ainda não existe (migration 0004 não rodou) — catálogo vazio.
      cache = [];
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

  // Importação por IA: lê a foto de um produto (e-commerce, WhatsApp, print) e
  // devolve um rascunho de nome/categoria/preço. Nunca lança — em falha devolve
  // um rascunho mínimo para o lojista completar.
  async draftFromImage(
    imageUrl: string,
  ): Promise<{ name: string; category: string; price: number | null }> {
    try {
      const prompt =
        "Analise a peça de roupa/produto de moda na imagem e responda APENAS um JSON válido " +
        '(sem markdown, sem crases) com: "name" (nome curto do produto em pt-BR), "category" (a ' +
        `mais próxima entre: ${CATALOG_CATEGORIES.join(", ")}), "price" (número em reais estimado ` +
        'ou null). Baseie-se só no que é visível.';
      const raw = await AIService.describe(prompt, [imageUrl]);
      const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as {
        name?: string;
        category?: string;
        price?: number | string | null;
      };
      const price = parsed.price == null ? null : Number(parsed.price) || null;
      return {
        name: parsed.name?.toString().trim() || "Peça sem nome",
        category: parsed.category?.toString().trim() || "",
        price,
      };
    } catch {
      return { name: "Peça sem nome", category: "", price: null };
    }
  },

  // Importa o catálogo a partir de um LINK (e-commerce, Instagram, etc.). A
  // Edge Function acessa a página e extrai os produtos com IA. Só devolve a lista
  // (o app confirma, cobra tokens e cria as peças). Lança com mensagem amigável.
  async importFromUrl(
    url: string,
  ): Promise<{ name: string; category: string; price: number | null; imageUrl: string }[]> {
    const { data, error } = await supabase.functions.invoke("import-catalog", { body: { url } });
    if (error) {
      let detail = error.message;
      try {
        const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
        const parsed = await ctx?.json?.();
        if (parsed?.error) detail = parsed.error;
      } catch {
        /* ignora */
      }
      throw new Error(detail || "Não foi possível importar do link.");
    }
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    const list = (data as { products?: unknown[] })?.products ?? [];
    return list
      .map((p) => {
        const o = p as Record<string, unknown>;
        return {
          name: (o.name ?? "").toString().trim(),
          category: (o.category ?? "").toString().trim(),
          price: o.price == null ? null : Number(o.price) || null,
          imageUrl: (o.imageUrl ?? "").toString().trim(),
        };
      })
      .filter((p) => p.name);
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
