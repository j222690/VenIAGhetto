// AssetService — biblioteca de ativos.
// trocar por Supabase Storage + tabela assets.

import type { Asset, AssetCategory } from "@/types";
import { seedAssets } from "./_temp/seed";

let assets: Asset[] = [...seedAssets];

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
  add(asset: Omit<Asset, "id" | "createdAt">): Asset {
    const created: Asset = {
      ...asset,
      id: `a_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    assets = [created, ...assets];
    return created;
  },
  remove(ids: string[]): void {
    assets = assets.filter((a) => !ids.includes(a.id));
  },
};
