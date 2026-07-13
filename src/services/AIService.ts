// AIService — wrapper genérico para chamadas de IA.
// trocar por chamadas reais (Gemini text/vision, Imagen 3) via Edge Function.

export const AIService = {
  async complete(_prompt: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 600));
    return "Texto gerado (placeholder)";
  },
  async image(_prompt: string): Promise<{ url: string }> {
    await new Promise((r) => setTimeout(r, 1500));
    return {
      url: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&q=80",
    };
  },
};
