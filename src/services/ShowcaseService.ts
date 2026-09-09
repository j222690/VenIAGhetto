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
import type { ModeloCarrossel } from "@/constants/postModels";
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

/**
 * Roteiro de um carrossel, escrito a partir de um pedido em português.
 *
 * Existe para o post começar onde a ideia começa — "um carrossel sobre o
 * cliente que some depois do vou pensar, público masculino" — em vez de o
 * dono ter que traduzir isso em manchete, chapéu e prompt de cena, um campo
 * de cada vez. É a diferença entre pedir e preencher formulário.
 */
export interface Roteiro {
  publico: "feminino" | "masculino";
  /** Quem aparece nas cenas. Repetido em todas para o rosto não trocar. */
  personagem: string;
  /** Cenas geradas por IA, na ordem. Uma ou duas. */
  cenas: string[];
  slides: { chapeu: string; titulo: string }[];
  cta: { titulo: string; botao: string; rodape: string };
}

const ROTEIRO_REGRAS = `
Escreva o ROTEIRO de um carrossel de Instagram de 5 slides para vender o app a
DONOS DE LOJA DE MODA. O slide 5 é sempre a chamada, e vem pronta: você não a
escreve. Os quatro primeiros seguem a estrutura pedida abaixo.

COMO ESCREVER AS FRASES
- Português do Brasil, falado, curto. Manchete de no máximo 8 palavras.
- Marque UMA palavra da manchete com *asteriscos*: é o destaque da arte.
- O chapéu é a linha pequena acima: no máximo 6 palavras, sem ponto final.
- NÃO invente número, porcentagem, prazo ou pesquisa. Nenhum. Se a frase pede
  um dado que você não tem, reescreva a frase.
- NÃO prometa resultado de venda ("aumente 60%"). Fale do atrito e do alívio.
- Nada de emoji, hashtag ou nome de marca de terceiros.

AS CENAS (o que a IA vai desenhar)
- Quantas e para que servem, está na estrutura abaixo. Não invente uma a mais.
- Descreva LUGAR, POSTURA e EXPRESSÃO, não roupa de marca. Ex.: "sentada na
  poltrona da sala à noite, olhando o celular com o cenho franzido, luz baixa".
- É sempre a MESMA pessoa em todas as cenas, em momentos diferentes.
- Nunca peça texto, letreiro, logotipo ou tela de aplicativo na imagem.

O PERSONAGEM
- Uma frase descrevendo a pessoa das cenas (idade aproximada, cabelo, tipo),
  para ela não mudar de rosto entre um slide e outro.
- Se o pedido fala do público masculino, é um homem; senão, uma mulher.
`.trim();

const ROTEIRO_FORMATO = (cenas: number) => `

Responda SÓ com JSON, sem cercas de código:
{
  "publico": "feminino" | "masculino",
  "personagem": "...",
  "cenas": [${Array.from({ length: cenas }, () => '"..."').join(", ")}],
  "slides": [
    {"chapeu": "...", "titulo": "..."},
    {"chapeu": "...", "titulo": "..."},
    {"chapeu": "...", "titulo": "..."},
    {"chapeu": "...", "titulo": "..."}
  ]
}
São exatamente 4 slides e ${cenas === 0 ? "NENHUMA cena" : `${cenas} cena(s)`}.`;

function parseRoteiro(raw: string, cenasEsperadas: number): Roteiro {
  const limpo = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (ini < 0 || fim < 0) throw new Error("O roteiro não voltou em JSON. Tente pedir de novo.");
  const p = JSON.parse(limpo.slice(ini, fim + 1)) as Partial<Roteiro>;

  const slides = (p.slides ?? [])
    .map((s) => ({ chapeu: (s?.chapeu ?? "").trim(), titulo: (s?.titulo ?? "").trim() }))
    .filter((s) => s.titulo);
  if (slides.length < 4) throw new Error("O roteiro voltou incompleto. Tente pedir de novo.");

  const cenas = (p.cenas ?? [])
    .map((c) => (c ?? "").trim())
    .filter(Boolean)
    .slice(0, cenasEsperadas);
  if (cenas.length < cenasEsperadas) {
    throw new Error(
      `O roteiro devolveu ${cenas.length} cena(s) em vez de ${cenasEsperadas}. Tente pedir de novo.`,
    );
  }

  return {
    publico: p.publico === "masculino" ? "masculino" : "feminino",
    personagem: (p.personagem ?? "").trim() || "uma pessoa brasileira de uns 30 anos",
    cenas,
    slides: slides.slice(0, 4),
    // A chamada é fixa: repetir treina quem acompanha a conta a saber o que
    // fazer, e é o único slide que não depende da história.
    cta: {
      titulo: "Quer testar na *sua* peça?",
      botao: "Comente TESTAR",
      rodape: "que eu te mando o link",
    },
  };
}

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

// ÂNGULOS. Um por post, sorteado quando o dono não escreve o dele.
//
// Existe porque as legendas saíam todas iguais: cinco posts seguidos abriam
// com a mesma dúvida da cliente e fechavam com "sem ensaio fotográfico".
// Pedir "varie" não resolve — o modelo volta ao mesmo miolo. Dar um ângulo
// concreto e diferente a cada post resolve, porque muda o assunto, não o
// estilo.
const ANGULOS = [
  "o tempo: o look pronto antes de a cliente perder o interesse",
  "o provador que não trava mais a fila da loja",
  "a peça que encalha porque ninguém imagina ela vestida",
  "atender quem mora longe e nunca ia pisar na loja",
  "a cliente que pede foto no WhatsApp e some quando você demora",
  "o ensaio fotográfico que a loja pequena não tem como pagar",
  "montar combinações do estoque parado",
  "a troca que não acontece porque ela já viu como fica",
];

export const angulaAleatorio = (): string => ANGULOS[Math.floor(Math.random() * ANGULOS.length)];

// Frases que o modelo repete sozinho, post após post. Listadas para ele ter o
// que evitar — proibir o clichê é mais eficaz do que pedir originalidade.
const REPETIDAS =
  ' EVITE estas frases, já gastas de tanto uso: "sem sair de casa", "sem ensaio ' +
  'fotográfico", "em segundos", "sem precisar ir até a loja", "caimento perfeito", ' +
  '"impecável", "fecha a venda na hora". Diga a mesma ideia com outras palavras, ou ' +
  "mude o que está sendo dito.";

const TOM =
  " Escreva em português do Brasil, falando DIRETO COM A LOJISTA (você), com tom próximo e " +
  "concreto. Fale de resultado no negócio e não de tecnologia. Nada de jargão de IA, nada de " +
  "promessa exagerada de faturamento, sem emoji em excesso (no máximo 2). " +
  'NUNCA invente estatística, porcentagem ou pesquisa: nada de "70% das conversas", ' +
  '"aumente 3x", "a maioria dos lojistas". Não temos esses números, e quem lê pode ' +
  "perguntar de onde saíram. Fale do mecanismo — o que acontece no atendimento — que é " +
  "verdade sem precisar de número. " +
  "ABRA de um jeito diferente do óbvio: pode ser uma cena do balcão, um número, uma " +
  'objeção da cliente, uma comparação — o que NÃO pode é começar com "Sabe aquela ' +
  'cliente que…" ou "Imagina…". ' +
  REPETIDAS +
  ` Termine o desc do instagram convidando para ${SITE}.`;

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
    // Sem ângulo escrito pelo dono, sorteia um: é o que impede cinco posts
    // seguidos de dizerem a mesma coisa.
    const extra = ` Escreva ESTE post em torno de: ${anguloExtra?.trim() || angulaAleatorio()}.`;
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
      ` Escreva em torno de: ${angulaAleatorio()}.` +
      TOM +
      FORMATO_JSON;
    return parseCopy(await AIService.complete(prompt));
  },

  // Imagem de anúncio criada do zero. Custa 1 geração (feature "post").
  //
  // `referenciaUrl` é uma cena JÁ GERADA cuja pessoa deve reaparecer nesta.
  // Num carrossel é o que separa cinco fotos soltas de uma história: se a cada
  // slide aparece outra mulher, ninguém entende que é a mesma cliente antes e
  // depois. A referência entra como imagem de entrada, não como texto — pedir
  // "mulher de cabelo cacheado" de novo devolve outra pessoa.
  async imagemTema(
    tema: string,
    formato: "feed" | "story" | "carrossel",
    referenciaUrl?: string,
  ): Promise<string> {
    const prompt =
      "Fotografia publicitária realista para um anúncio de aplicativo voltado a lojas de moda no " +
      "Brasil. " +
      `Cena: ${tema.trim()}. ` +
      (referenciaUrl
        ? "A pessoa desta cena é EXATAMENTE a mesma da imagem de referência: mesmo rosto, mesmo " +
          "cabelo, mesma cor de pele, mesma idade. Copie o rosto da referência. Mude apenas o " +
          "cenário, a pose e a roupa conforme a cena pedida. "
        : "") +
      "Luz natural, cores quentes e suaves, aparência de foto de celular profissional — não de " +
      "render 3D nem de ilustração. Pessoas brasileiras, roupas atuais, ambiente de loja de roupas " +
      "Enquadre as pessoas no CENTRO, de corpo inteiro ou meio corpo, com folga " +
      "em volta: a imagem é recortada para caber no post, e sujeito colado na borda perde a cabeça. " +
      "Sacolas, etiquetas e vitrines SEM MARCA e SEM TEXTO: uma sacola com nome de loja inventado " +
      "vira propaganda de concorrente, e já saiu uma com o nome de uma marca real. " +
      "NÃO escreva nenhuma palavra, letra, número, logo ou interface de aplicativo na imagem: " +
      "texto gerado por IA sai deformado e estraga o anúncio.";
    // A proporção pedida é a da ÁREA DA FOTO, não a do post: depois do bloco
    // da manchete e do rodapé, o espaço da imagem no story fica quase
    // quadrado. Pedir 9:16 e encaixar ali cortava a cena — a primeira prova
    // saiu com os rostos cortados na base.
    const { url } = await AIService.image(prompt, "post", {
      aspectRatio: formato === "story" ? "1:1" : "5:4",
      imageUrls: referenciaUrl ? [referenciaUrl] : undefined,
    });
    return url;
  },

  // Transforma um pedido em português no ROTEIRO do carrossel. Não gera
  // imagem: só decide a história, as cenas e as frases. Custa uma chamada de
  // texto.
  async roteiro(pedido: string, modelo: ModeloCarrossel): Promise<Roteiro> {
    const prompt =
      BRIEF_PRODUTO +
      `\n\nO dono do app pediu este post, com as palavras dele: "${pedido.trim()}".\n\n` +
      ROTEIRO_REGRAS +
      `\n\nA ESTRUTURA DESTE CARROSSEL:\n${modelo.instrucao}\n` +
      ROTEIRO_FORMATO(modelo.cenas);
    return parseRoteiro(await AIService.complete(prompt), modelo.cenas);
  },
};
