// FavoritesService — API de favoritos de looks, voltada para a UI.
//
// Favorito é estado da LOJA (não do usuário): um look favoritado vale para
// todos da loja. O armazenamento vive no GenerationService (dono da lista de
// looks); este service é a fachada que as telas chamam. Quando as gerações
// vierem do Supabase, o GenerationService persiste no banco (coluna
// `generations.is_favorite`, RLS por loja — ver migration 0002).

import type { Generation } from "@/types";
import { GenerationService } from "./GenerationService";

export const FavoritesService = {
  // Lista síncrona dos looks favoritados (para a UI).
  listFavorites(): Generation[] {
    return GenerationService.favorites();
  },

  isFavorite(id: string): boolean {
    return GenerationService.find(id)?.isFavorite ?? false;
  },

  // Alterna o favorito e devolve o novo estado.
  async toggleFavorite(id: string): Promise<boolean> {
    return GenerationService.toggleFavorite(id);
  },

  async setFavorite(id: string, value: boolean): Promise<boolean> {
    return GenerationService.setFavorite(id, value);
  },
};
