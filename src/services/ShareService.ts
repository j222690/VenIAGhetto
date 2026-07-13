// ShareService — compartilhamento de looks.
//
// Usa a Web Share API quando disponível; senão, faz fallback para copiar o
// link. Também expõe download da imagem. Mantém toda a lógica fora dos
// componentes (as telas só chamam estes métodos e exibem o toast).

export type ShareResult = "shared" | "copied" | "canceled";

export interface ShareParams {
  title: string;
  text?: string;
  url: string;
}

export const ShareService = {
  canShare(): boolean {
    return typeof navigator !== "undefined" && typeof navigator.share === "function";
  },

  // Compartilha via Web Share API; em fallback copia o link para a área de
  // transferência. Cancelamento pelo usuário retorna "canceled" (sem erro).
  async share(params: ShareParams): Promise<ShareResult> {
    if (this.canShare()) {
      try {
        await navigator.share(params);
        return "shared";
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return "canceled";
        }
        // Erro real do share → tenta copiar como fallback.
      }
    }

    try {
      await navigator.clipboard.writeText(params.url);
      return "copied";
    } catch {
      return "canceled";
    }
  },

  // Baixa a imagem para o aparelho (galeria/downloads). Busca a URL como blob
  // e dispara o download via link com `download` — assim o navegador salva o
  // arquivo em vez de abrir. Funciona em Android (Downloads) e desktop; no iOS
  // o blob abre para o usuário salvar nas Fotos. Lança Error se a busca falhar.
  async downloadImage(url: string, filename = "styledesk-look.jpg"): Promise<void> {
    let blob: Blob;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      blob = await response.blob();
    } catch {
      throw new Error("Não foi possível baixar a imagem.");
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoga depois de um tempo: revogar na hora pode cancelar o download em
    // alguns navegadores mobile.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  },

  // Monta um nome de arquivo amigável: `look_2026-06-18.jpg` ou, com cliente,
  // `maria-souza_2026-06-18.jpg`. A extensão vem da URL (fallback jpg).
  lookFilename(url: string, opts: { createdAt: string; clientName?: string }): string {
    const date = new Date(opts.createdAt);
    const isoDate = Number.isNaN(date.getTime())
      ? new Date().toISOString().slice(0, 10)
      : date.toISOString().slice(0, 10);
    const base = opts.clientName ? slug(opts.clientName) : "look";
    return `${base || "look"}_${isoDate}.${imageExtFromUrl(url)}`;
  },
};

// Extensão de imagem a partir da URL (ignora query/hash). Default: jpg.
function imageExtFromUrl(url: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const match = clean.match(/\.(jpe?g|png|webp|gif|avif)$/i);
  if (!match) return "jpg";
  return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
}

// Slug seguro para nome de arquivo (sem acentos/espaços/símbolos).
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
