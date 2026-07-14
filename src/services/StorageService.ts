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

    // Caminho isolado por loja: a policy de Storage exige store_id como 1ª pasta.
    const filename = `${crypto.randomUUID()}.${extensionFor(file)}`;
    const path = `${storeId}/${filename}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      throw new Error("Não foi possível enviar a imagem. Tente novamente.");
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  },
};
