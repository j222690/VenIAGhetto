// Cliente Supabase único do StyleDesk AI.
// Importado APENAS pela camada de services (src/services/*). Nenhum componente
// deve falar com o Supabase diretamente — os services são a única fronteira.
//
// Usa somente a chave pública (anon). A service_role key jamais entra no
// frontend: ela ignora o RLS.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!rawUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (veja .env.example).",
  );
}

// O supabase-js espera APENAS a URL base do projeto
// (https://<ref>.supabase.co) e monta sozinho os caminhos /auth/v1 e /rest/v1.
// Normalizamos para tolerar um .env com barra/sufixo a mais (ex.: ".../rest/v1/")
// que geraria caminhos quebrados como /rest/v1/auth/v1/signup.
const supabaseUrl = rawUrl
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/(rest|auth)\/v1$/, "");

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
