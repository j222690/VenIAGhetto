// ProductService / ScannerService — análise de peça por imagem (OpenAI Vision).
//
// Recebe a URL de uma foto de peça e devolve uma ProductSheet estruturada,
// extraída pela visão da OpenAI (gpt-4o) via Edge Function. Se a IA falhar ou
// retornar algo não-parseável, cai no modelo vazio de `_temp` (sem inventar).

import type { ProductSheet } from "@/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { AIService } from "./AIService";
import { StoreService } from "./StoreService";
import { seedProductSheet } from "./_temp/seed";

const SCAN_PROMPT =
  "Você é um especialista em catálogo de moda. Analise a peça de roupa da imagem e retorne " +
  "APENAS um JSON válido (sem markdown, sem crases) com as chaves EXATAS: " +
  '"name" (nome curto da peça), "category", "colors" (array de strings), "fabric", "style", ' +
  '"occasion", "suggestedPriceBRL" (número em reais, sem símbolo), "tags" (array), ' +
  '"sizes" (array, ex.: ["P","M","G"]), "seoTitle", "shortDescription", "longDescription". ' +
  "Tudo em pt-BR, com base no que é visível na imagem.";

function coerceSheet(raw: string, sourceImageUrl: string): ProductSheet {
  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const parsed = JSON.parse(clean.slice(start, end + 1)) as Partial<ProductSheet>;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  return {
    id: `p_${Date.now()}`,
    sourceImageUrl,
    name: parsed.name?.toString() ?? "Peça analisada",
    colors: arr(parsed.colors),
    fabric: parsed.fabric?.toString() ?? "",
    style: parsed.style?.toString() ?? "",
    occasion: parsed.occasion?.toString() ?? "",
    suggestedPriceBRL: Number(parsed.suggestedPriceBRL) || 0,
    tags: arr(parsed.tags),
    sizes: arr(parsed.sizes),
    seoTitle: parsed.seoTitle?.toString() ?? "",
    shortDescription: parsed.shortDescription?.toString() ?? "",
    longDescription: parsed.longDescription?.toString() ?? "",
    category: parsed.category?.toString() ?? "",
  };
}

export const ProductService = {
  async scan(imageUrl: string): Promise<ProductSheet> {
    try {
      const raw = await AIService.describe(SCAN_PROMPT, [imageUrl]);
      return coerceSheet(raw, imageUrl);
    } catch {
      // Fallback: ficha vazia (o usuário preenche) — nunca dados inventados.
      return seedProductSheet(imageUrl);
    }
  },

  update(sheet: ProductSheet, patch: Partial<ProductSheet>): ProductSheet {
    return { ...sheet, ...patch };
  },

  // Salva a ficha analisada no acervo (tabela product_sheets, RLS por loja).
  async save(sheet: ProductSheet): Promise<void> {
    const storeId = StoreService.get().id;
    if (!storeId) throw new Error("Nenhuma loja carregada.");
    const { error } = await supabase
      .from("product_sheets")
      .insert({ store_id: storeId, fields_json: sheet as unknown as Json });
    if (error) throw error;
  },
};

export const ScannerService = ProductService;
