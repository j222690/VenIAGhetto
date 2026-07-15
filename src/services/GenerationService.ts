// GenerationService — gerações (provador, post, scanner).
//
// O FLUXO é real: debita token, grava a linha em `generations` e alimenta
// histórico/álbum a partir do banco. APENAS a imagem é provisória — onde a IA
// (Gemini/Imagen) entraria, usamos um placeholder de `_temp`. Ver o ponto
// marcado em `generate()`.

import type {
  Generation,
  GenerationInputs,
  GenerationType,
  SocialCopySet,
  StoreSegment,
} from "@/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { mapGeneration, GENERATION_TYPE_TO_DB } from "@/integrations/supabase/mappers";
import { seedSocialCopy } from "./_temp/seed";
import { AIService } from "./AIService";
import { StoreService } from "./StoreService";
import { TokenService } from "./TokenService";

// Prompt padrão (fallback) quando a tela não fornece um específico.
function defaultPrompt(type: GenerationType, inputs: GenerationInputs): string {
  const notes = inputs.notes?.trim();
  if (notes) return notes;
  if (type === "post")
    return "Foto de moda profissional para redes sociais, iluminação vibrante, alta qualidade.";
  return "Foto de moda editorial, corpo inteiro, iluminação de estúdio, ultra-realista.";
}

// Gera a copy do post OLHANDO a imagem gerada (visão OpenAI): a legenda reflete
// o que realmente aparece na foto (peça, cor, estilo). Retorna JSON estruturado;
// lança em erro/parse — quem chama faz fallback para o modelo de exemplo.
const AUDIENCE_BRIEF: Record<StoreSegment, string> = {
  feminina: "moda FEMININA, público feminino — tom e vocabulário voltados para mulheres",
  masculina: "moda MASCULINA, público masculino — tom e vocabulário voltados para homens",
  unissex: "moda UNISSEX, público variado — linguagem neutra que fala com todos",
};

async function generatePostCopy(
  imageUrl: string,
  context?: string,
  audience?: StoreSegment,
): Promise<SocialCopySet> {
  const brand = StoreService.get().name?.trim() || "nossa loja";
  const audienceLine = audience ? ` Considere o público: ${AUDIENCE_BRIEF[audience]}.` : "";
  const ctxLine = context?.trim() ? ` Contexto extra do lojista: ${context.trim()}.` : "";
  // Pedimos "hook" e "desc" SEPARADOS (sem quebras de linha dentro do JSON, que
  // invalidariam o parse) e montamos a legenda com \n\n no código.
  const prompt =
    "Você é copywriter de moda brasileiro. OLHE a imagem deste post e escreva a legenda conforme " +
    "o que aparece nela: analise as PEÇAS de roupa (tipo, cor, tecido), o MODELO e o CONTEXTO " +
    "geral da foto (cenário, clima, ocasião)." +
    audienceLine +
    ctxLine +
    " Para CADA canal (instagram, whatsapp, facebook) devolva um objeto com: \"hook\" (uma frase " +
    "curta e chamativa, ex.: 'Novidade fresca na loja — vem dar uma olhada nessa peça incrível!') e " +
    "\"desc\" (descreva as peças que aparecem com o MÁXIMO de detalhes que você conseguir identificar " +
    "na imagem — tipo, cor E o tecido/material quando der para notar, ex.: 'camisa de linho branca, " +
    "calça de camurça marrom, tênis casual de couro'. Só cite o material se tiver razoável certeza " +
    `pela textura; não invente. Separe por vírgula e termine com a marca: ${brand}). ` +
    "NÃO use quebras de linha dentro dos textos. Responda APENAS um JSON válido (sem markdown, sem " +
    'crases) no formato: {"instagram":{"hook":"","desc":""},"whatsapp":{"hook":"","desc":""},' +
    '"facebook":{"hook":"","desc":""},"hashtags":["#..."],"cta":""}. hashtags: array com 4 a 6.';
  // Visão (OpenAI gpt-4o) sobre a imagem gerada.
  const raw = await AIService.describe(prompt, [imageUrl]);
  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const parsed = JSON.parse(clean.slice(start, end + 1)) as {
    instagram?: { hook?: string; desc?: string };
    whatsapp?: { hook?: string; desc?: string };
    facebook?: { hook?: string; desc?: string };
    hashtags?: string[];
    cta?: string;
  };
  const compose = (ch?: { hook?: string; desc?: string }): string =>
    [ch?.hook?.trim(), ch?.desc?.trim()].filter(Boolean).join("\n\n");
  const instagram = compose(parsed.instagram);
  if (!instagram || !Array.isArray(parsed.hashtags)) {
    throw new Error("Copy inválida");
  }
  return {
    instagram,
    whatsapp: compose(parsed.whatsapp) || instagram,
    facebook: compose(parsed.facebook) || instagram,
    hashtags: parsed.hashtags ?? [],
    cta: parsed.cta ?? "",
  };
}

// Cache em memória (fonte síncrona da UI). Começa VAZIO e reflete apenas as
// gerações reais da loja carregadas por `load()`.
let generations: Generation[] = [];

// Custo em tokens por operação — alinhado ao custo real de IA (ver relatório de
// margens). Provador com VÁRIAS peças processa mais imagens de referência na
// mesma geração → custa um pouco mais (mas é UMA só chamada de IA — não gera
// mais uma imagem extra; ver TryOnPage.run em tryon.tsx).
const TOKEN_COST: Record<GenerationType, number> = {
  tryon: 5, // 1 peça
  post: 5,
  scanner: 1,
};
const TRYON_MULTI_COST = 8; // provador com 2+ peças

export const GenerationService = {
  history(): Generation[] {
    return generations;
  },

  // Custo do Provador conforme o nº de peças (várias peças = flat-lay + vestir).
  tryonCost(pieceCount: number): number {
    return pieceCount >= 2 ? TRYON_MULTI_COST : TOKEN_COST.tryon;
  },

  filter(type?: GenerationType): Generation[] {
    return type ? generations.filter((g) => g.type === type) : generations;
  },

  find(id: string): Generation | undefined {
    return generations.find((g) => g.id === id);
  },

  // Carrega as gerações reais da loja. Não lança: se a tabela ainda não existir
  // ou estiver vazia, o álbum/histórico ficam vazios (estado real da loja).
  // Seguro de chamar no bootstrap.
  async load(): Promise<Generation[]> {
    try {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      generations = (data ?? []).map(mapGeneration);
    } catch {
      generations = [];
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
    // Prompt específico da tela (Provador/Posts montam a partir das escolhas).
    prompt?: string;
    // Imagens de referência (foto do cliente, peça) — URLs de buckets públicos.
    imageUrls?: string[];
    // Público-alvo do post — dá contexto à copy (feminina/masculina/unissex).
    audience?: StoreSegment;
    // Gerar legenda por IA (visão sobre a imagem)? Padrão: sim para posts.
    withCopy?: boolean;
    // Custo em tokens explícito (o Provador calcula por nº de peças).
    tokenCost?: number;
  }): Promise<Generation> {
    const cost = params.tokenCost ?? TOKEN_COST[params.type];

    // Bloqueia se não houver saldo (a UI também avisa antes de chamar).
    if (!TokenService.hasBalance(cost)) {
      throw new Error("INSUFFICIENT_TOKENS");
    }

    // Geração REAL de imagem via Gemini (Edge Function segura). O Scanner passa
    // `resultUrl` (a própria peça analisada) e não gera imagem nova.
    let resultUrl = params.resultUrl;
    if (!resultUrl) {
      const prompt = params.prompt?.trim() || defaultPrompt(params.type, params.inputs);
      const refs = params.imageUrls?.length ? { imageUrls: params.imageUrls } : undefined;
      const { url } = await AIService.image(prompt, refs);
      resultUrl = url;
    }
    // Copy do post: a IA de visão OLHA a imagem gerada e escreve a legenda.
    // Só quando o lojista pediu legenda por IA (withCopy). Fallback no exemplo.
    let copies: SocialCopySet | undefined;
    if (params.type === "post" && params.withCopy !== false) {
      copies = await generatePostCopy(resultUrl, params.inputs.notes, params.audience).catch(
        () => seedSocialCopy,
      );
    }

    // Débito real do token (persiste em token_transactions + stores).
    await TokenService.debit(cost, `Geração: ${params.type}`);

    // Persiste a geração no banco (RLS por loja). A legenda (copies) é salva na
    // coluna `copies` (jsonb) para ficar guardada com a imagem no álbum.
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
          copies: (copies as unknown as Json) ?? null,
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
    generations = [];
  },
};
