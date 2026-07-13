// GenerationService — gerações (provador, post, scanner).
//
// O FLUXO é real: debita token, grava a linha em `generations` e alimenta
// histórico/álbum a partir do banco. APENAS a imagem é provisória — onde a IA
// (Gemini/Imagen) entraria, usamos um placeholder de `_temp`. Ver o ponto
// marcado em `generate()`.

import type { Generation, GenerationInputs, GenerationType } from "@/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { mapGeneration, GENERATION_TYPE_TO_DB } from "@/integrations/supabase/mappers";
import { placeholderResult, seedGenerations, seedSocialCopy } from "./_temp/seed";
import { TokenService } from "./TokenService";

// Cache em memória (fonte síncrona da UI). Inicia com o seed como fallback de
// visualização; `load()` substitui pelas gerações reais da loja.
let generations: Generation[] = [...seedGenerations];

const TOKEN_COST: Record<GenerationType, number> = {
  tryon: 3,
  post: 5,
  scanner: 1,
};

export const GenerationService = {
  history(): Generation[] {
    return generations;
  },

  filter(type?: GenerationType): Generation[] {
    return type ? generations.filter((g) => g.type === type) : generations;
  },

  find(id: string): Generation | undefined {
    return generations.find((g) => g.id === id);
  },

  // Carrega as gerações reais da loja. Não lança: se a tabela/coluna ainda não
  // existir (migrations não rodadas) ou estiver vazia, mantém o seed para a UI
  // não ficar morta. Seguro de chamar no bootstrap.
  async load(): Promise<Generation[]> {
    try {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        generations = data.map(mapGeneration);
      } else {
        generations = [...seedGenerations]; // TEMPORÁRIO: fallback de visualização.
      }
    } catch {
      generations = [...seedGenerations];
    }
    return generations;
  },

  costFor(type: GenerationType): number {
    return TOKEN_COST[type];
  },

  async generate(params: {
    type: GenerationType;
    inputs: GenerationInputs;
    userId: string;
    storeId: string;
    clientId?: string;
    // Resultado explícito (ex.: o Scanner usa a própria foto analisada).
    resultUrl?: string;
  }): Promise<Generation> {
    const cost = TOKEN_COST[params.type];

    // Bloqueia se não houver saldo (a UI também avisa antes de chamar).
    if (!TokenService.hasBalance(cost)) {
      throw new Error("INSUFFICIENT_TOKENS");
    }

    // =====================================================================
    // TEMPORÁRIO: trocar pela chamada real de IA (Gemini/Imagen) aqui.
    // Por enquanto simulamos o tempo de processamento e usamos uma imagem de
    // exemplo de `_temp`. Todo o resto (token, persistência, histórico) é real.
    // =====================================================================
    await new Promise((r) => setTimeout(r, 1500));
    const resultUrl = params.resultUrl ?? placeholderResult(params.type);
    const copies = params.type === "post" ? seedSocialCopy : undefined;
    // =====================================================================

    // Débito real do token (persiste em token_transactions + stores).
    await TokenService.debit(cost, `Geração: ${params.type}`);

    // Persiste a geração no banco (RLS por loja). `copies` não tem coluna —
    // fica só no objeto retornado (o Criador de Posts a usa na hora).
    try {
      const { data, error } = await supabase
        .from("generations")
        .insert({
          store_id: params.storeId,
          user_id: params.userId,
          type: GENERATION_TYPE_TO_DB[params.type],
          input_refs: params.inputs as unknown as Json,
          output_url: resultUrl,
          tokens_used: cost,
          is_favorite: false,
          client_id: params.clientId ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      const created: Generation = { ...mapGeneration(data), copies };
      generations = [created, ...generations];
      return created;
    } catch {
      // Pré-migration / offline: mantém o fluxo com um objeto local.
      const created: Generation = {
        id: `g_${Date.now()}`,
        storeId: params.storeId,
        userId: params.userId,
        type: params.type,
        inputs: params.inputs,
        resultUrl,
        copies,
        tokensCost: cost,
        isFavorite: false,
        clientId: params.clientId,
        createdAt: new Date().toISOString(),
      };
      generations = [created, ...generations];
      return created;
    }
  },

  // Favoritar/desfavoritar (por LOJA — RLS cobre). Otimista no cache + persiste.
  async setFavorite(id: string, value: boolean): Promise<boolean> {
    generations = generations.map((g) => (g.id === id ? { ...g, isFavorite: value } : g));
    try {
      await supabase.from("generations").update({ is_favorite: value }).eq("id", id);
    } catch {
      // item de seed/local — mantém só no cache.
    }
    return value;
  },

  async toggleFavorite(id: string): Promise<boolean> {
    const target = generations.find((g) => g.id === id);
    if (!target) return false;
    return this.setFavorite(id, !target.isFavorite);
  },

  favorites(): Generation[] {
    return generations.filter((g) => g.isFavorite);
  },

  // Busca no banco as gerações de um cliente (filtrando por client_id, sob o
  // RLS por loja). É a fonte de verdade da "pasta do cliente": reflete na hora
  // os looks salvos no Provador. Faz fallback para o cache se o banco falhar.
  async listByClient(clientId: string): Promise<Generation[]> {
    try {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const looks = (data ?? []).map(mapGeneration);
      // Mescla no cache para a UI síncrona ficar consistente.
      const others = generations.filter((g) => g.clientId !== clientId);
      generations = [...looks, ...others];
      return looks;
    } catch {
      return generations.filter((g) => g.clientId === clientId);
    }
  },

  reset(): void {
    generations = [...seedGenerations];
  },
};
