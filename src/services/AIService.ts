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
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("generate-image", { body });
  if (error) {
    // Tenta extrair a mensagem de erro retornada pela função.
    let detail = error.message;
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      const parsed = await ctx?.json?.();
      if (parsed?.error) detail = parsed.error;
    } catch {
      /* ignora */
    }
    throw new Error(detail || "Falha na geração com IA.");
  }
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export const AIService = {
  // Gera/edita uma imagem com o Gemini (gemini-2.5-flash-image) e devolve a URL
  // pública do resultado já salvo no Storage.
  async image(prompt: string, refs?: ImageRefs): Promise<{ url: string }> {
    return invoke<{ url: string }>({
      mode: "image",
      prompt,
      imageUrls: refs?.imageUrls,
      images: refs?.images,
    });
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
};
