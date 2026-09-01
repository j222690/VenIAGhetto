// AIService — ponte para a IA real (Gemini) via Edge Function `generate-image`.
//
// A GEMINI_API_KEY nunca vive no frontend: fica como secret na Edge Function,
// que autentica o usuário, chama o Gemini e (para imagens) sobe o resultado no
// bucket `generated`, devolvendo a URL pública.

import { supabase } from "@/integrations/supabase/client";

export interface ImageRefs {
  // Imagens de referência já hospedadas (buckets públicos) — a função baixa.
  imageUrls?: string[];
  // Ou imagens inline (base64) quando ainda não foram para o Storage.
  images?: { mimeType: string; data: string }[];
  // Formato de saída (ex.: "3:4" pra foto de pessoa) — sem isso o Gemini usa
  // um formato padrão dele, podendo espremer/cortar a pessoa da referência.
  aspectRatio?: string;
  // Resolução de saída. Padrão "1K" (mais barato). "2K" só vale a pena quando
  // a imagem de saída é SUBDIVIDIDA em painéis (Grade de Looks): aí cada painel
  // fica com uma fração dos pixels e o rosto degrada. Custa ~50% mais caro por
  // imagem, então não use no fluxo normal de 1 pessoa por imagem.
  imageSize?: "1K" | "2K";
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("generate-image", { body });
  if (error) {
    // Tenta extrair a mensagem de erro retornada pela função (o corpo da
    // resposta só pode ser lido UMA vez — se der erro no JSON, tenta texto
    // puro antes de cair na mensagem genérica do SDK).
    let detail = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.clone === "function") {
      try {
        const parsed = (await ctx.clone().json()) as { error?: string };
        if (parsed?.error) detail = parsed.error;
      } catch {
        try {
          const text = await ctx.text();
          if (text?.trim()) detail = text.trim();
        } catch {
          /* mantém a mensagem genérica */
        }
      }
    }
    throw new Error(detail || "Falha na geração com IA.");
  }
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export const AIService = {
  // Gera/edita uma imagem com o Gemini e devolve a URL pública do resultado já
  // salvo no Storage. `feature` identifica a operação (tryon/post/refine/
  // clean_image) — o custo em tokens é validado e DEBITADO no SERVIDOR a
  // partir dela (nunca confiando num valor calculado no cliente); a função
  // devolve o saldo já atualizado em `balance`.
  async image(
    prompt: string,
    feature: "tryon" | "post" | "refine" | "clean_image" | "criar_corpo",
    refs?: ImageRefs,
  ): Promise<{ url: string; balance?: number }> {
    // Round-trip COMPLETO (rede + Gemini + upload no Storage). Comparado com
    // o log do lado do servidor ([generate-image] <modelo> OK em Xms), mostra
    // quanto do tempo é a IA de fato e quanto é overhead nosso — e denuncia
    // quando uma geração levou o dobro por ter caído no modelo de fallback.
    const startedAt = performance.now();
    try {
      return await invoke<{ url: string; balance?: number }>({
        mode: "image",
        feature,
        prompt,
        imageUrls: refs?.imageUrls,
        images: refs?.images,
        aspectRatio: refs?.aspectRatio,
        imageSize: refs?.imageSize,
      });
    } finally {
      const ms = Math.round(performance.now() - startedAt);
      console.info(`[AIService.image] ${feature}: ${ms}ms (prompt ${prompt.length} chars)`);
    }
  },

  // Dispara a geração em SEGUNDO PLANO e devolve na hora. O servidor grava o
  // resultado na linha `generationId` quando terminar (ver mode "image_async"
  // em generate-image) — quem chama acompanha com GenerationService.waitFor.
  //
  // Existe porque a Edge Function SÍNCRONA é encerrada pela Supabase em 150s,
  // e o Gemini leva de 11s a 131s: o limite fica dentro da faixa normal de
  // operação. Como o Google cobra a imagem mesmo se desistirmos de esperar,
  // cada estouro de teto era imagem paga e jogada fora.
  async imageAsync(
    prompt: string,
    feature: "tryon" | "post",
    generationId: string,
    refs?: ImageRefs,
  ): Promise<{ generationId: string; balance?: number }> {
    return invoke<{ generationId: string; balance?: number }>({
      mode: "image_async",
      feature,
      prompt,
      generationId,
      imageUrls: refs?.imageUrls,
      images: refs?.images,
      aspectRatio: refs?.aspectRatio,
      imageSize: refs?.imageSize,
    });
  },

  // Pede ao servidor que marque como falha (e reembolse) as gerações que
  // ficaram presas em "processando" — ver mode "rescue_stuck".
  async rescueStuck(): Promise<{ resgatadas: number }> {
    return invoke<{ resgatadas: number }>({ mode: "rescue_stuck" });
  },

  // Gera texto com o Gemini (gemini-2.5-flash). Aceita imagens de referência
  // (visão) — usado, por exemplo, para descrever/analisar uma peça.
  async complete(prompt: string, refs?: ImageRefs): Promise<string> {
    const { text } = await invoke<{ text: string }>({
      mode: "text",
      prompt,
      imageUrls: refs?.imageUrls,
      images: refs?.images,
    });
    return text;
  },

  // Visão (OpenAI gpt-4o): analisa/descreve peças de roupa a partir das URLs.
  // Usada antes da geração para dar fidelidade ao look (cores, tecidos, tipos).
  async describe(prompt: string, imageUrls: string[]): Promise<string> {
    const { text } = await invoke<{ text: string }>({ mode: "vision", prompt, imageUrls });
    return text;
  },

  // Guarda do "Criar corpo": classifica o ENQUADRAMENTO da foto antes de
  // gastar token. Três casos, e os três importam:
  //
  //  • "completa" — já mostra da cabeça aos pés. Mandar completar uma foto que
  //    não tem nada faltando é instrução contraditória: OBSERVADO na prática,
  //    o modelo travou 120s e falhou. Além de cobrar por algo desnecessário.
  //  • "curta"    — só rosto/close/cortada acima da cintura. Aí a IA teria que
  //    inventar o corpo quase inteiro, e um corpo que não parece o do cliente
  //    é pior que não ter a função — o lojista mostra isso pro cliente na
  //    frente dele. Regra de produto: mínimo de meio corpo pra cima.
  //  • "ok"       — meio corpo pra cima, sem os pés: é o caso que a função
  //    existe pra resolver.
  //
  // Se a visão falhar, devolve "ok" — a guarda não pode virar um bloqueio
  // acidental do lojista por indisponibilidade de um serviço auxiliar.
  async bodyFramingCheck(
    imageUrl: string,
  ): Promise<{ status: "completa" | "curta" | "ok"; mensagem: string }> {
    // Duas perguntas VISUAIS e concretas em vez de uma taxonomia abstrata.
    // A versão anterior pedia pra classificar o enquadramento em COMPLETA /
    // MEIA / CURTA e errou na prática: chamou de MEIA uma foto de corpo
    // inteiro com os sapatos claramente visíveis, e o lojista pagou uma
    // geração à toa. "Os pés aparecem?" é observação direta, não julgamento.
    const prompt =
      "Olhe esta foto e responda EXATAMENTE no formato PES=?,CINTURA=? sem nenhuma outra palavra.\n" +
      "PES=SIM se os pés ou os sapatos da pessoa aparecem na foto; PES=NAO se não aparecem.\n" +
      "CINTURA=SIM se a cintura/quadril da pessoa aparece; CINTURA=NAO se a foto corta acima da " +
      "cintura (só rosto, só cabeça e ombros, ou close).\n" +
      "Se não houver nenhuma pessoa na foto, responda PES=NAO,CINTURA=NAO.\n" +
      "Exemplo de resposta válida: PES=NAO,CINTURA=SIM";
    let text = "";
    try {
      text = await this.describe(prompt, [imageUrl]);
    } catch {
      return { status: "ok", mensagem: "" };
    }
    const t = (text || "").trim().toUpperCase();
    const pes = /PES\s*=\s*SIM/.test(t);
    const cintura = /CINTURA\s*=\s*SIM/.test(t);
    // Resposta fora do formato: não bloqueia (segue e gera), pra a guarda não
    // impedir o lojista por causa de um retorno mal formatado da visão.
    const respondeu = /PES\s*=/.test(t) && /CINTURA\s*=/.test(t);
    if (respondeu && pes) {
      return {
        status: "completa",
        mensagem: "Esta foto já mostra o cliente de corpo inteiro — não precisa gerar.",
      };
    }
    if (respondeu && !cintura) {
      return {
        status: "curta",
        mensagem:
          "A foto está cortada acima da cintura — a IA teria que inventar quase o corpo todo.",
      };
    }
    return { status: "ok", mensagem: "" };
  },

  // Avalia se a FOTO da peça é boa para a prova virtual. A IA reconstrói a peça,
  // então detalhe escondido (fecho/braguilha) ou peça dobrada saem infiéis.
  // Retorna um aviso curto em pt-BR se a foto for ruim, ou "" se estiver boa.
  async garmentPhotoTip(imageUrl: string): Promise<string> {
    const prompt =
      "Você avalia se a FOTO desta peça de roupa serve como referência para uma prova " +
      "virtual (a IA precisa VER a peça inteira e reta para reproduzi-la fiel). " +
      "Responda com UMA frase curta em pt-BR APENAS se a foto for RUIM para isso — " +
      "por exemplo: peça dobrada/amassada/torta escondendo o corte; fecho, botão, " +
      "braguilha, zíper ou bolso não aparentes; foto de ângulo/lado, borrada, escura " +
      'ou cortando a peça. Ex.: "O fecho da calça não está aparente o suficiente, isso ' +
      'pode deixar a geração infiel à realidade." Se a foto estiver BOA (peça reta, de ' +
      "frente, detalhes visíveis), responda EXATAMENTE com: OK";
    let text = "";
    try {
      text = await this.describe(prompt, [imageUrl]);
    } catch {
      return ""; // se a visão falhar, não atrapalha o fluxo
    }
    const t = (text || "").trim();
    if (!t || /^ok\b/i.test(t) || t.toUpperCase() === "OK") return "";
    return t.replace(/^["']|["']$/g, "");
  },
};
