import { supabase, supabaseConfigError } from "../lib/supabase";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

async function requisitarPerfil(method, usuarioId, dados, signal) {
  if (!supabase) throw new Error(supabaseConfigError || "Acesso à conta indisponível.");

  // O SDK restaura/renova a sessão. A API é quem valida o JWT de verdade.
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token || data.session.user.id !== usuarioId) {
    throw new Error("Sua sessão mudou ou expirou. Entre novamente na sua conta.");
  }
  const timeout = AbortSignal.timeout(15000);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/perfil`, {
      method,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(dados ? { "Content-Type": "application/json" } : {}),
      },
      ...(dados ? { body: JSON.stringify(dados) } : {}),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: "no-store",
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Não foi possível acessar seus dados. Verifique a conexão e tente novamente.", { cause: error });
  }
  const resultado = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(resultado?.erro || "Não foi possível acessar seu perfil.");
  }
  if (!resultado?.perfil || resultado.perfil.id !== usuarioId) {
    throw new Error("A API não confirmou o perfil desta conta.");
  }
  return resultado.perfil;
}

// Repetir a sincronização não cria outro perfil e não apaga as edições.
export function sincronizarPerfil(usuarioId, signal) {
  return requisitarPerfil("POST", usuarioId, undefined, signal);
}

export function atualizarPerfil(usuarioId, dados, signal) {
  return requisitarPerfil("PATCH", usuarioId, dados, signal);
}
