// StorageService — upload real de imagens no Supabase Storage.
//
// Buckets (ver migration 0005): `catalog` (fotos de peças) e `clients` (fotos
// de clientes). Os arquivos são organizados por loja no caminho
// `store_id/uuid.ext` e as policies de Storage garantem que uma loja só
// escreve/altera/apaga dentro da própria pasta — isolamento por loja.
//
// Ambos são buckets PÚBLICOS (leitura) → URL pública estável. Isso é
// obrigatório para `clients`: a foto do cliente agora é PERSISTIDA
// (clients.photo_url, migration 0014) como foto-base do Provador, reutilizada
// entre sessões — uma signed URL (com expiração) quebraria depois de algumas
// horas. A escrita continua isolada por loja pelas policies de Storage.

import { supabase } from "@/integrations/supabase/client";
import { StoreService } from "./StoreService";

export type StorageBucket = "catalog" | "clients";

// Limites de validação amigáveis.
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_PREFIX = "image/";

function extensionFor(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() : "";
  if (fromName) return fromName.toLowerCase();
  // Fallback pelo mime (ex.: capturas de câmera podem vir sem nome de arquivo).
  const fromType = file.type.split("/")[1];
  return (fromType || "jpg").toLowerCase();
}

// Redimensiona/comprime no navegador antes do upload — fotos de câmera vêm
// com vários MB e são exibidas em thumbnails pequenos; sem isso o app fica
// lento pra carregar as grades (catálogo, clientes). Mantém 1600px no maior
// lado, o suficiente pra qualidade do Provador IA e do catálogo.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function downscaleImage(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // formato não suportado pelo navegador — envia original

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close?.();
    return file; // já pequena o suficiente, não vale recomprimir
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file; // recompressão não ajudou — mantém original

  const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export const StorageService = {
  /**
   * Envia uma imagem para o bucket informado, na pasta da loja logada, e
   * devolve a URL pública. Lança Error com mensagem amigável em caso de
   * arquivo inválido ou falha de upload.
   */
  async uploadImage(file: File, bucket: StorageBucket): Promise<{ url: string; path: string }> {
    if (!file.type.startsWith(ACCEPTED_PREFIX)) {
      throw new Error("Selecione um arquivo de imagem (JPG, PNG ou WebP).");
    }
    if (file.size > MAX_BYTES) {
      throw new Error("Imagem muito grande. O limite é 8 MB.");
    }

    const storeId = StoreService.get().id;
    if (!storeId) {
      throw new Error("Nenhuma loja carregada — entre novamente para enviar imagens.");
    }

    const upload = await downscaleImage(file);

    // Caminho isolado por loja: a policy de Storage exige store_id como 1ª pasta.
    const filename = `${crypto.randomUUID()}.${extensionFor(upload)}`;
    const path = `${storeId}/${filename}`;

    // cacheControl longo + imutável: nome é sempre um UUID novo (upsert:false),
    // então o arquivo nunca muda — pode ficar em cache no navegador/CDN por 1 ano.
    const { error } = await supabase.storage.from(bucket).upload(path, upload, {
      cacheControl: "31536000",
      contentType: upload.type,
      upsert: false,
    });
    if (error) {
      throw new Error("Não foi possível enviar a imagem. Tente novamente.");
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  },
};
