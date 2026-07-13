// ProductService / ScannerService — análise de peça por imagem.
// trocar por Gemini Vision via Edge Function.

import type { ProductSheet } from "@/types";
import { seedProductSheet } from "./_temp/seed";

export const ProductService = {
  async scan(imageUrl: string): Promise<ProductSheet> {
    await new Promise((r) => setTimeout(r, 1800));
    return seedProductSheet(imageUrl);
  },

  update(sheet: ProductSheet, patch: Partial<ProductSheet>): ProductSheet {
    return { ...sheet, ...patch };
  },
};

export const ScannerService = ProductService;
