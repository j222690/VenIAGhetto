// ClientService — clientes da loja (CRM simples, tabela clients).
//
// Cliente é pessoa que a loja ATENDE e NÃO faz login (sem ligação com auth).
// RLS isola por loja; toda a equipe da loja (qualquer papel) administra. O
// carregamento é sob demanda na tela.

import type { Client, ClientPhoto, Generation } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapClient, mapClientPhoto } from "@/integrations/supabase/mappers";
import { StoreService } from "./StoreService";
import { GenerationService } from "./GenerationService";
import { AIService } from "./AIService";
import { TokenService } from "./TokenService";
import { CREATE_BODY_CLAUSE } from "@/constants/prompts";
import { genUrl } from "@/lib/imageUrl";

export interface ClientInput {
  name: string;
  instagram?: string | null;
  phone?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
}

let cache: Client[] = [];

export const ClientService = {
  // Leitura síncrona do cache.
  list(): Client[] {
    return cache;
  },

  find(id: string): Client | undefined {
    return cache.find((c) => c.id === id);
  },

  // Busca local por nome (sobre o cache já carregado).
  search(query: string): Client[] {
    const q = query.trim().toLowerCase();
    if (!q) return cache;
    return cache.filter((c) => c.name.toLowerCase().includes(q));
  },

  async load(): Promise<Client[]> {
    const { data, error } = await supabase.from("clients").select("*").order("name");
    if (error) throw error;
    cache = (data ?? []).map(mapClient);
    return cache;
  },

  async addClient(input: ClientInput): Promise<Client> {
    const storeId = StoreService.get().id;
    if (!storeId) throw new Error("Nenhuma loja carregada.");

    const { data, error } = await supabase
      .from("clients")
      .insert({
        store_id: storeId,
        name: input.name.trim(),
        instagram: input.instagram || null,
        phone: input.phone || null,
        notes: input.notes || null,
        photo_url: input.photoUrl || null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const client = mapClient(data);
    cache = [...cache, client].sort((a, b) => a.name.localeCompare(b.name));
    return client;
  },

  async updateClient(id: string, patch: ClientInput): Promise<Client> {
    const { data, error } = await supabase
      .from("clients")
      .update({
        name: patch.name.trim(),
        instagram: patch.instagram || null,
        phone: patch.phone || null,
        notes: patch.notes || null,
        photo_url: patch.photoUrl || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    const client = mapClient(data);
    cache = cache
      .map((c) => (c.id === id ? client : c))
      .sort((a, b) => a.name.localeCompare(b.name));
    return client;
  },

  // Pasta do cliente: todas as imagens geradas para ele (busca real em
  // generations por client_id, sob o RLS por loja). Delega ao GenerationService,
  // dono da tabela `generations`.
  listClientGenerations(clientId: string): Promise<Generation[]> {
    return GenerationService.listByClient(clientId);
  },

  async removeClient(id: string): Promise<void> {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
    cache = cache.filter((c) => c.id !== id);
  },

  // Galeria de fotos ADICIONAIS do cliente (além da foto-base) — subidas
  // depois que o cliente já foi cadastrado, na pasta do cliente (migration 0021).
  async listPhotos(clientId: string): Promise<ClientPhoto[]> {
    const { data, error } = await supabase
      .from("client_photos")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapClientPhoto);
  },

  async addPhoto(clientId: string, url: string): Promise<ClientPhoto> {
    const storeId = StoreService.get().id;
    if (!storeId) throw new Error("Nenhuma loja carregada.");
    const { data, error } = await supabase
      .from("client_photos")
      .insert({ store_id: storeId, client_id: clientId, url })
      .select("*")
      .single();
    if (error) throw error;
    return mapClientPhoto(data);
  },

  async removePhoto(id: string): Promise<void> {
    const { error } = await supabase.from("client_photos").delete().eq("id", id);
    if (error) throw error;
  },

  // CRIAR CORPO — a partir de uma foto de meio corpo, gera a MESMA pessoa em
  // corpo inteiro e guarda o resultado na galeria do cliente.
  //
  // Existe porque o Provador precisa da pessoa inteira pra vestir a peça, e na
  // prática o lojista quase sempre tem foto cortada.
  //
  // Roda em SEGUNDO PLANO (ver GenerationService.runAsync): pelo caminho
  // síncrono, uma geração que passasse de 150s morria no teto da plataforma —
  // e o Google cobra a imagem mesmo assim, então era foto paga e token perdido.
  // A linha em `generations` existe só para acompanhar; o álbum a filtra.
  async createFullBodyPhoto(
    clientId: string,
    sourcePhotoUrl: string,
    storeId: string,
    userId: string,
    onTick?: (segundos: number) => void,
  ): Promise<ClientPhoto> {
    const { url } = await GenerationService.runAsync({
      feature: "criar_corpo",
      prompt: CREATE_BODY_CLAUSE,
      userId,
      storeId,
      inputs: { clientPhotoUrl: sourcePhotoUrl },
      imageUrls: [genUrl(sourcePhotoUrl)],
      // Retrato ALTO, e não a proporção da foto enviada.
      //
      // Sem isto o servidor deduz o formato pela foto de origem — que é o
      // recorte de meio corpo, largo. O modelo então tem de caber a pessoa
      // inteira na mesma altura, e para isso encolhe e redesenha o que já
      // existia, inclusive o rosto. Pedindo 2:3 ele ganha o espaço vertical
      // que as pernas precisam e pode deixar a parte de cima como está.
      aspectRatio: "2:3",
      onTick,
    });
    return this.addPhoto(clientId, url);
  },

  // Promove uma foto da galeria a foto-BASE (a que pré-preenche o Provador).
  async setBasePhoto(id: string, photoUrl: string): Promise<Client> {
    const { data, error } = await supabase
      .from("clients")
      .update({ photo_url: photoUrl })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    const client = mapClient(data);
    cache = cache.map((c) => (c.id === id ? client : c));
    return client;
  },

  reset(): void {
    cache = [];
  },
};
