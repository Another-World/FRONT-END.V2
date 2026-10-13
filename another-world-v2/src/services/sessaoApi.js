import { supabase, supabaseConfigError } from "../lib/supabase";

// getSession escolhe a sessão do navegador; somente a API valida o JWT.
// A identidade esperada impede enviar um formulário/lista de uma conta usando
// um token renovado após troca de usuário. Falhas nunca viram envios anônimos.
export async function obterSessaoApi(usuarioId = null, obrigatoria = false) {
  if (!supabase) {
    if (usuarioId || obrigatoria) throw new Error(supabaseConfigError || "Acesso à conta indisponível.");
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Não foi possível verificar sua sessão. Entre novamente na sua conta.");
  const sessao = data.session;
  const atual = sessao?.user?.id ?? null;
  if (atual !== usuarioId || (obrigatoria && !sessao?.access_token) || (sessao && !sessao.access_token)) {
    throw new Error("Sua sessão mudou ou expirou. Entre novamente na sua conta.");
  }
  return sessao;
}
