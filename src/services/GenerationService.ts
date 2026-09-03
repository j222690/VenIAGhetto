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
    ' Para CADA canal (instagram, whatsapp, facebook) devolva um objeto com: "hook" (uma frase ' +
    "curta e chamativa, ex.: 'Novidade fresca na loja — vem dar uma olhada nessa peça incrível!') e " +
    '"desc" (descreva as peças que aparecem com o MÁXIMO de detalhes que você conseguir identificar ' +
    "na imagem — tipo, cor E o tecido/material quando der para notar, ex.: 'camisa de linho branca, " +
    "calça de camurça marrom, tênis casual de couro'. Só cite o material se tiver razoável certeza " +
    `pela textura; não invente. Separe por vírgula e termine com a marca: ${brand}). ` +
    "NÃO use quebras de linha dentro dos textos. Responda APENAS um JSON válido (sem markdown, sem " +
    'crases) no formato: {"instagram":{"hook":"","desc":""},"whatsapp":{"hook":"","desc":""},' +
    '"facebook":{"hook":"","desc":""},"hashtags":["#..."],"cta":""}. hashtags: array com 4 a 6.';
  // Visão (OpenAI gpt-4o) sobre a imagem gerada.
  const raw = await AIService.describe(prompt, [imageUrl]);
  const clean = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
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

// Custo em tokens por operação — flat, 1 token por geração (token = R$0,65).
// Provador/Post usam a grade de QUADRANTES (composeQuadrant) pra looks de até
// 4 peças: 1 chamada de imagem só, custo real ~igual não importa o nº de
// peças (~R$0,43 Provador, ~R$0,45 Post com Gemini 3.1 Flash Image) — por
// isso 1 peça e 2-4 peças custam o MESMO: 1 token. Margem a R$0,65: Provador
// ~34%, Post ~31%, Scanner ~94% (custo real ~R$0,04).
//
// O look para de 4 peças (MAX_GARMENTS), que é o que cabe na grade 2x2 e numa
// chamada só. Existia um caminho sequencial para 5+ que fazia uma chamada por
// peça — e o servidor debitava em cada uma, então um look de 5 custava 5
// tokens sem que a tela avisasse. Foi removido: acima de 4 peças o caminho é
// a foto do look inteiro, que sai por 1 token e ainda mostra como as peças
// combinam de verdade.
const TOKEN_COST: Record<GenerationType, number> = {
  tryon: 1,
  post: 1,
  scanner: 1,
  // Mesmo custo real: uma chamada de imagem cada (ver FEATURE_COST no servidor,
  // que é quem debita de verdade).
  refine: 1,
  clean_image: 1,
  criar_corpo: 1,
};

export const GenerationService = {
  history(): Generation[] {
    return generations;
  },

  // Custo do Provador — flat, não varia mais com o nº de peças (ver comentário acima).
  tryonCost(pieceCount: number): number {
    void pieceCount;
    return TOKEN_COST.tryon;
  },

  // Custo do Post — flat, mesma lógica do Provador.
  postCost(pieceCount: number): number {
    void pieceCount;
    return TOKEN_COST.post;
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
      // Só LOOK: refino, limpeza e corpo têm linha em `generations` apenas
      // para poder rodar em segundo plano (ver migration 0029). Não são coisa
      // que o lojista procura no álbum — refino é uma versão de um look que
      // já está lá, limpeza é foto de peça e corpo é foto de cliente.
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .in("type", ["provador", "post", "scanner"])
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
    // true quando quem chamou (Provador/Post) já gerou a imagem chamando
    // AIService.image() diretamente — nesse caso o token já foi debitado no
    // SERVIDOR (dentro da Edge Function, ver generate-image) e não deve ser
    // cobrado de novo aqui.
    alreadyDebited?: boolean;
  }): Promise<Generation> {
    const cost = params.tokenCost ?? TOKEN_COST[params.type];

    if (!params.alreadyDebited && !TokenService.hasBalance(cost)) {
      throw new Error("INSUFFICIENT_TOKENS");
    }

    // Geração REAL de imagem via Gemini (Edge Function segura). O Scanner passa
    // `resultUrl` (a própria peça analisada) e não gera imagem nova.
    let resultUrl = params.resultUrl;
    if (!resultUrl) {
      const prompt = params.prompt?.trim() || defaultPrompt(params.type, params.inputs);
      const refs = params.imageUrls?.length ? { imageUrls: params.imageUrls } : undefined;
      const { url } = await AIService.image(prompt, params.type as "tryon" | "post", refs);
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

    // Débito real do token (persiste em token_transactions + stores) — só
    // quando ainda NÃO foi cobrado no servidor (ver `alreadyDebited` acima).
    if (!params.alreadyDebited) {
      await TokenService.debit(cost, `Geração: ${params.type}`);
    }

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
        status: "pronta",
      };
      generations = [created, ...generations];
      return created;
    }
  },

  // GERAÇÃO EM SEGUNDO PLANO.
  //
  // O fluxo síncrono prendia o lojista na tela e esbarrava no limite de 150s
  // da Edge Function — que fica DENTRO da faixa normal do Gemini (11s a 131s
  // medidos), então gerações lentas viravam erro. Pior: o Google cobra a
  // imagem mesmo quando desistimos de esperar (7 de 7 verificadas), então
  // cada erro desses era dinheiro pago e perdido.
  //
  // Aqui a linha nasce com status "processando" e o servidor a completa depois
  // (ver mode "image_async" em generate-image). O lojista pode sair da tela.
  async startAsync(params: {
    type: GenerationType;
    inputs: GenerationInputs;
    userId: string;
    storeId: string;
    clientId?: string;
    prompt: string;
    feature: "tryon" | "post" | "refine" | "clean_image" | "criar_corpo";
    imageUrls?: string[];
    images?: { mimeType: string; data: string }[];
    aspectRatio?: string;
    tokenCost?: number;
  }): Promise<Generation> {
    const cost = params.tokenCost ?? TOKEN_COST[params.type];
    if (!TokenService.hasBalance(cost)) throw new Error("INSUFFICIENT_TOKENS");

    // 1) Cria a linha ANTES de pedir a geração: é ela que o lojista vai
    //    acompanhar, e é o id que o servidor usa pra gravar o resultado.
    const { data, error } = await supabase
      .from("generations")
      .insert({
        store_id: params.storeId,
        user_id: params.userId,
        type: GENERATION_TYPE_TO_DB[params.type],
        input_refs: params.inputs as unknown as Json,
        output_url: null,
        tokens_used: cost,
        is_favorite: false,
        client_id: params.clientId ?? null,
        status: "processando",
      })
      .select("*")
      .single();
    if (error) throw error;
    const criada = mapGeneration(data);
    generations = [criada, ...generations];

    // 2) Dispara. O servidor responde na hora e termina em background.
    //
    // Se o disparo FALHAR (rede fora, função recusando a origem), a linha tem
    // de sair: o token não chegou a ser debitado — quem debita é o servidor,
    // dentro da chamada que acabou de falhar —, mas a linha ficaria em
    // "processando" para sempre. Dez minutos depois o resgate a marcaria como
    // falha e DEVOLVERIA um token que ninguém cobrou, criando saldo do nada.
    // Visto de verdade: uma porta de desenvolvimento fora da lista de origens
    // permitidas deixou três linhas assim.
    let balance: number | undefined;
    try {
      ({ balance } = await AIService.imageAsync(params.prompt, params.feature, criada.id, {
        imageUrls: params.imageUrls,
        images: params.images,
        aspectRatio: params.aspectRatio,
      }));
    } catch (e) {
      generations = generations.filter((g) => g.id !== criada.id);
      await supabase.from("generations").delete().eq("id", criada.id);
      throw e;
    }
    TokenService.syncAfterServerDebit(cost, `Geração: ${params.type}`, balance);
    return criada;
  },

  // Escreve a legenda numa geração que JÁ existe.
  //
  // Pelo caminho síncrono a legenda era escrita antes de a linha ser criada,
  // dentro de generate(). Em segundo plano a linha nasce primeiro (é ela que o
  // lojista acompanha), então a legenda entra depois — aqui.
  async attachCopy(
    id: string,
    imageUrl: string,
    contexto?: string,
    audience?: StoreSegment,
  ): Promise<SocialCopySet> {
    const copies = await generatePostCopy(imageUrl, contexto, audience).catch(() => seedSocialCopy);
    await supabase
      .from("generations")
      .update({ copies: copies as unknown as Json })
      .eq("id", id);
    generations = generations.map((g) => (g.id === id ? { ...g, copies } : g));
    return copies;
  },

  // Roda UMA geração em segundo plano e devolve só a URL pronta, escondendo a
  // linha de acompanhamento de quem chama.
  //
  // Existe para Refino, Limpar imagem e Criar corpo, que chamavam a IA pelo
  // caminho síncrono. A Supabase encerra uma função síncrona em 150s e o
  // Gemini leva de 11s a 131s: o teto caía dentro da faixa normal. Como o
  // Google cobra a imagem mesmo quando desistimos de esperar, cada estouro era
  // imagem paga jogada fora E o token do lojista perdido, porque não havia
  // linha para reembolsar. Por aqui são 400s de orçamento, reembolso
  // automático na falha e aviso por push quando termina.
  async runAsync(params: {
    feature: "refine" | "clean_image" | "criar_corpo" | "post";
    /**
     * Tipo da linha, quando difere da feature. Serve aos passos INTERMEDIÁRIOS
     * de geração que não são um look do álbum — cobram como a feature diz,
     * mas o tipo os mantém fora do álbum.
     */
    type?: GenerationType;
    prompt: string;
    userId: string;
    storeId: string;
    inputs?: GenerationInputs;
    imageUrls?: string[];
    images?: { mimeType: string; data: string }[];
    aspectRatio?: string;
    onTick?: (segundos: number) => void;
  }): Promise<{ url: string; balance?: number }> {
    const pedida = await this.startAsync({
      type: params.type ?? params.feature,
      feature: params.feature,
      inputs: params.inputs ?? {},
      userId: params.userId,
      storeId: params.storeId,
      prompt: params.prompt,
      imageUrls: params.imageUrls,
      images: params.images,
      aspectRatio: params.aspectRatio,
    });
    const pronta = await this.waitFor(pedida.id, params.onTick);
    if (pronta.status === "falhou" || !pronta.resultUrl) {
      throw new Error(pronta.errorMessage ?? "A geração não foi concluída.");
    }
    return { url: pronta.resultUrl, balance: TokenService.balance() };
  },

  // Pede ao servidor que resgate gerações presas em "processando".
  //
  // A tarefa em segundo plano da Supabase é encerrada aos 400s; se isso pegar
  // a geração no meio, ela morre sem marcar a linha como falha e sem devolver
  // o token (visto num teste: linha parada em 356s). Chamado no bootstrap do
  // app, que é quando o lojista voltaria e notaria.
  //
  // O trabalho acontece no SERVIDOR de propósito: o reembolso mexe em saldo, e
  // deixar o cliente creditar tokens seria dar saldo infinito a quem chamasse
  // a API direto. Aqui só pedimos.
  async rescueStuck(): Promise<number> {
    try {
      const { resgatadas } = await AIService.rescueStuck();
      if (resgatadas > 0) await this.load();
      return resgatadas;
    } catch {
      return 0; // serviço fora do ar não pode travar a abertura do app
    }
  },

  // Acompanha uma geração até terminar. Consulta a cada `intervaloMs`; chama
  // `onTick` a cada checagem com os segundos decorridos, pra a tela poder
  // avisar que está demorando. Sondagem em vez de realtime: o app não usa
  // realtime em nenhum outro lugar, e isso evita introduzir uma dependência
  // nova por causa de uma tela só.
  // Carrega UMA geração pelo id. Usado quando o lojista chega pelo aviso de
  // "sua imagem está pronta": o app abre direto no resultado daquela geração,
  // e não numa lista onde ele teria de procurá-la.
  async byId(id: string): Promise<Generation | null> {
    const emCache = generations.find((g) => g.id === id);
    if (emCache && emCache.status === "pronta") return emCache;
    const { data, error } = await supabase.from("generations").select("*").eq("id", id).single();
    if (error || !data) return null;
    const g = mapGeneration(data);
    generations = generations.some((x) => x.id === g.id)
      ? generations.map((x) => (x.id === g.id ? g : x))
      : [g, ...generations];
    return g;
  },

  async waitFor(
    id: string,
    onTick?: (segundos: number) => void,
    intervaloMs = 3000,
    limiteMs = 420_000,
  ): Promise<Generation> {
    const inicio = Date.now();
    for (;;) {
      const { data, error } = await supabase.from("generations").select("*").eq("id", id).single();
      if (!error && data) {
        const g = mapGeneration(data);
        if (g.status !== "processando") {
          generations = generations.map((x) => (x.id === id ? g : x));
          return g;
        }
      }
      const decorrido = Date.now() - inicio;
      if (decorrido > limiteMs) throw new Error("A geração demorou mais que o esperado.");
      onTick?.(Math.round(decorrido / 1000));
      await new Promise((r) => setTimeout(r, intervaloMs));
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

  // Exclui uma foto gerada (Álbum/Histórico/pasta do cliente) — RLS por loja
  // cobre (generations_all_same_store, migration 0001). Não exclui o cliente,
  // só o registro da geração/imagem.
  async remove(id: string): Promise<void> {
    try {
      await supabase.from("generations").delete().eq("id", id);
    } catch {
      // item de seed/local — remove do cache mesmo assim.
    }
    generations = generations.filter((g) => g.id !== id);
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
