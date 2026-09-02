// ShowcaseService — posts para DIVULGAR O APP (tela /divulgar).
//
// É o inverso do Criador de Posts: lá o cliente é a cliente da loja e o
// produto é a roupa; aqui o cliente é o LOJISTA e o produto é a Vest Ai. Por
// isso a legenda tem outro tom e outro público, e não reaproveita
// generatePostCopy (que fala de tecido e caimento).
//
// Só quem é dono/gerente da loja da Vest Ai chega aqui — o gate de verdade
// está na Edge Function admin-showcase.

import { supabase } from "@/integrations/supabase/client";
import { AIService } from "@/services/AIService";
import type { SocialCopySet } from "@/types";

export interface ShowcaseItem {
  id: string;
  resultUrl: string;
  clientPhotoUrl: string | null;
  type: string;
  createdAt: string;
  storeName: string;
  /** true = gerada pela própria loja da Vest Ai (não precisa pedir autorização). */
  ownStore: boolean;
  /** Marcada com ♥ no Álbum. */
  favorito: boolean;
}

const SITE = "vestaiapp.com";

// Hashtags FIXAS, escritas à mão. A IA gerava as dela a cada post e inventava
// palavra — saíram "#lojadervelas" e "#lojadearroupas" no primeiro teste. Como
// o público e o produto são sempre os mesmos, não há o que recalcular: uma
// lista curada é mais certa e ainda deixa o post mais rápido.
const HASHTAGS = [
  "#lojademoda",
  "#varejodemoda",
  "#vendasonline",
  "#provadorvirtual",
  "#lojista",
  "#modabrasil",
];

// O que a Vest Ai vende, em uma frase, para a IA não inventar recurso que não
// existe nem prometer o que o produto não faz.
const BRIEF_PRODUTO =
  "A Vest Ai é um app brasileiro de provador virtual para LOJAS DE MODA. A lojista tira uma foto " +
  "da cliente (ou usa uma foto que a cliente mandou) e o app mostra a mesma pessoa vestindo as " +
  "peças da loja, em segundos, pelo celular. Serve para vender pelo WhatsApp e pelo Instagram sem " +
  "a cliente ir até a loja provar, e para montar looks do catálogo sem ensaio fotográfico.";

function parseCopy(raw: string): SocialCopySet {
  const limpo = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  const parsed = JSON.parse(limpo.slice(ini, fim + 1)) as {
    instagram?: { hook?: string; desc?: string };
    whatsapp?: { hook?: string; desc?: string };
    facebook?: { hook?: string; desc?: string };
    cta?: string;
  };
  const juntar = (c?: { hook?: string; desc?: string }) =>
    [c?.hook?.trim(), c?.desc?.trim()].filter(Boolean).join("\n\n");
  const instagram = juntar(parsed.instagram);
  if (!instagram) throw new Error("Copy inválida");
  return {
    instagram,
    whatsapp: juntar(parsed.whatsapp) || instagram,
    facebook: juntar(parsed.facebook) || instagram,
    hashtags: HASHTAGS,
    cta: parsed.cta?.trim() || `Conheça em ${SITE}`,
  };
}

const FORMATO_JSON =
  " Responda APENAS um JSON válido (sem markdown, sem crases), sem quebras de linha DENTRO dos " +
  'textos, no formato: {"instagram":{"hook":"","desc":""},"whatsapp":{"hook":"","desc":""},' +
  '"facebook":{"hook":"","desc":""},"cta":""}. Em cada canal, "hook" é uma frase curta de ' +
  'impacto e "desc" são 2 a 4 frases desenvolvendo. NÃO escreva hashtags: elas são fixas e ' +
  "entram depois.";

const TOM =
  " Escreva em português do Brasil, falando DIRETO COM A LOJISTA (você), com tom próximo e " +
  "concreto. Fale de resultado no negócio — vender mais pelo WhatsApp, atender sem a cliente ir " +
  "à loja, mostrar o catálogo inteiro — e não de tecnologia. Nada de jargão de IA, nada de " +
  "promessa exagerada de faturamento, sem emoji em excesso (no máximo 2). " +
  `Termine o desc do instagram convidando para ${SITE}.`;

export const ShowcaseService = {
  // Gerações prontas de todas as lojas, para servirem de antes/depois.
  async material(): Promise<ShowcaseItem[]> {
    const { data, error } = await supabase.functions.invoke("admin-showcase");
    if (error) throw new Error("Não foi possível carregar o material.");
    const payload = data as { items?: ShowcaseItem[]; error?: string };
    if (payload?.error) throw new Error(payload.error);
    return payload?.items ?? [];
  },

  // Legenda para um post de antes/depois: a IA OLHA o resultado e escreve em
  // cima do que aparece nele.
  async copyAntesDepois(depoisUrl: string, anguloExtra?: string): Promise<SocialCopySet> {
    const extra = anguloExtra?.trim() ? ` Ângulo pedido: ${anguloExtra.trim()}.` : "";
    const prompt =
      "Você é copywriter brasileiro e está escrevendo um post para vender um APLICATIVO a donas " +
      "de loja de moda. " +
      BRIEF_PRODUTO +
      " A imagem que você está vendo é um resultado real do app: a mesma pessoa antes e depois de " +
      "vestir uma peça da loja. Descreva o que ela mostra para provar o resultado." +
      extra +
      TOM +
      FORMATO_JSON;
    return parseCopy(await AIService.describe(prompt, [depoisUrl]));
  },

  // Legenda de um anúncio conceitual, a partir do tema que o dono descreveu
  // (sem imagem para olhar).
  async copyTema(tema: string): Promise<SocialCopySet> {
    const prompt =
      "Você é copywriter brasileiro e está escrevendo um post para vender um APLICATIVO a donas " +
      "de loja de moda. " +
      BRIEF_PRODUTO +
      ` O tema deste post é: ${tema.trim()}.` +
      TOM +
      FORMATO_JSON;
    return parseCopy(await AIService.complete(prompt));
  },

  // Imagem de anúncio criada do zero. Custa 1 geração (feature "post").
  async imagemTema(tema: string, formato: "feed" | "story" | "carrossel"): Promise<string> {
    const prompt =
      "Fotografia publicitária realista para um anúncio de aplicativo voltado a lojas de moda no " +
      "Brasil. " +
      `Cena: ${tema.trim()}. ` +
      "Luz natural, cores quentes e suaves, aparência de foto de celular profissional — não de " +
      "render 3D nem de ilustração. Pessoas brasileiras, roupas atuais, ambiente de loja de roupas " +
      "Enquadre as pessoas no CENTRO, de corpo inteiro ou meio corpo, com folga " +
      "em volta: a imagem é recortada para caber no post, e sujeito colado na borda perde a cabeça. " +
      "NÃO escreva nenhuma palavra, letra, número, logo ou interface de aplicativo na imagem: " +
      "texto gerado por IA sai deformado e estraga o anúncio.";
    // A proporção pedida é a da ÁREA DA FOTO, não a do post: depois do bloco
    // da manchete e do rodapé, o espaço da imagem no story fica quase
    // quadrado. Pedir 9:16 e encaixar ali cortava a cena — a primeira prova
    // saiu com os rostos cortados na base.
    const { url } = await AIService.image(prompt, "post", {
      aspectRatio: formato === "story" ? "1:1" : "5:4",
    });
    return url;
  },
};
