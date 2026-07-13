// TEMPORÁRIO — stand-ins enquanto a IA (Gemini/Imagen) não está integrada.
//
// IMPORTANTE: este arquivo NÃO contém mais catálogo/álbum/biblioteca fake.
// Album, histórico, biblioteca e catálogo agora começam VAZIOS e refletem
// apenas dados reais da loja. O que resta aqui só é usado quando o usuário
// DISPARA uma geração (provador/post/scanner) — é o resultado provisório que
// será trocado pela imagem/texto reais retornados pela IA.

import type { GenerationType, ProductSheet, SocialCopySet } from "@/types";

// Imagem de exemplo (Unsplash) usada como RESULTADO provisório da geração,
// no lugar da imagem que a IA (Gemini/Imagen) retornará.
const demoImg = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=900&q=80`;

// ---------------------------------------------------------------------------
// TEMPORÁRIO: imagem de RESULTADO da geração, por tipo. Trocar pela imagem
// real retornada pela IA em GenerationService.generate().
// ---------------------------------------------------------------------------
const PLACEHOLDER_RESULTS: Record<GenerationType, string> = {
  tryon: demoImg("1469334031218-e382a71b716b"),
  post: demoImg("1485518882345-15568b007407"),
  scanner: demoImg("1542060748-10c28b62716f"),
};

export const placeholderResult = (type: GenerationType): string =>
  PLACEHOLDER_RESULTS[type];

// TEMPORÁRIO: copys de exemplo p/ o Criador de Posts (substituir por IA).
export const seedSocialCopy: SocialCopySet = {
  instagram:
    "Para quem entende que estilo é coerência. Look novo, atemporal, pronto para você. ✨",
  whatsapp: "Oi! Acabou de chegar uma peça que vai com tudo no seu guarda-roupa. Quer ver?",
  facebook: "Novidade fresca na loja — vem dar uma olhada nessa peça incrível!",
  hashtags: ["#moda", "#vestia", "#tendencia", "#looknovo"],
  cta: "Compre agora · link na bio",
};

// TEMPORÁRIO: ficha de produto de exemplo p/ o Scanner (substituir por IA
// vision). Só é gerada quando o usuário escaneia uma peça.
export const seedProductSheet = (sourceImageUrl: string): ProductSheet => ({
  id: `p_${Date.now()}`,
  sourceImageUrl,
  name: "Peça analisada",
  colors: [],
  fabric: "",
  style: "",
  occasion: "",
  suggestedPriceBRL: 0,
  tags: [],
  sizes: [],
  seoTitle: "",
  shortDescription: "",
  longDescription: "",
  category: "",
});
