import { createClient } from "@supabase/supabase-js";
import "./authCallback";

// Vite lê estas variáveis ao iniciar/buildar o frontend.
// Aqui entra somente a chave PUBLICÁVEL; nunca use secret ou service_role.
const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

let client = null;
let configurationError = "";

try {
  if (!url || !key) throw new Error("Configuração ausente");
  if (!key.startsWith("sb_publishable_")) {
    throw new Error("Use a chave publicável do projeto");
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} catch {
  // Uma configuração ausente não deve derrubar a Home nem o Contato.
  configurationError = "O acesso à conta está indisponível no momento.";
}

export const supabase = client;
export const supabaseConfigError = configurationError;
