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
  async downloadImage(url: string, filename = "vest-ia-look.jpg"): Promise<void> {
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

  // Compartilha a IMAGEM como ARQUIVO via Web Share API (nível 2). No celular
  // isso abre a folha de compartilhamento nativa com Instagram, WhatsApp, etc.
  // Retorna "shared" (compartilhou), "canceled" (usuário fechou) ou
  // "unsupported" (navegador/desktop sem suporte a compartilhar arquivos).
  async shareImageFile(
    url: string,
    opts: { title?: string; text?: string; filename?: string } = {},
  ): Promise<"shared" | "canceled" | "unsupported"> {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return "unsupported";
    }
    let file: File;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      file = new File([blob], opts.filename ?? "vest-ia-look.png", {
        type: blob.type || "image/png",
      });
    } catch {
      return "unsupported";
    }
    // canShare({files}) confirma suporte real a arquivos antes de tentar.
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
      return "unsupported";
    }
    try {
      await navigator.share({ files: [file], title: opts.title, text: opts.text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "canceled";
      return "unsupported";
    }
  },

  // Compartilhar no WhatsApp. Tenta o compartilhamento nativo do arquivo (para
  // enviar a imagem direto); se não houver, abre o WhatsApp com o texto e o link
  // público da imagem (mostra a prévia). Sempre resolve — nunca lança.
  async shareToWhatsApp(url: string, text: string, filename?: string): Promise<void> {
    const r = await this.shareImageFile(url, { title: "Vest IA", text, filename });
    if (r === "shared" || r === "canceled") return;
    const msg = encodeURIComponent(`${text ? text + "\n" : ""}${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
  },

  // Postar no Instagram. O Instagram não tem API web para publicar direto a
  // partir de uma URL, então: no celular usamos o compartilhamento nativo (o
  // usuário escolhe o Instagram e a imagem já vai anexada); no desktop/sem
  // suporte, baixamos a imagem e abrimos o Instagram para o usuário postar.
  // Retorna "shared" (foi pro app) ou "fallback" (baixou + abriu o site).
  async shareToInstagram(url: string, filename?: string): Promise<"shared" | "fallback"> {
    const r = await this.shareImageFile(url, { title: "Vest IA", filename });
    if (r === "shared" || r === "canceled") return "shared";
    try {
      await this.downloadImage(url, filename);
    } catch {
      /* segue mesmo se o download falhar */
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    return "fallback";
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
