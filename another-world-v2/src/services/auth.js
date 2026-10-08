import { supabase, supabaseConfigError } from "../lib/supabase";

// Senhas são enviadas diretamente ao Supabase. Este módulo não as salva.
function authClient() {
  if (!supabase) throw new Error(supabaseConfigError);
  return supabase.auth;
}

export function authErrorMessage(error) {
  const messages = {
    invalid_credentials: "E-mail ou senha incorretos.",
    email_not_confirmed: "Confirme seu e-mail antes de entrar. Confira também a pasta de spam.",
    weak_password: "Escolha uma senha mais forte, com pelo menos 8 caracteres.",
    same_password: "Escolha uma senha diferente da atual.",
    over_email_send_rate_limit: "O limite de envio de e-mails foi atingido. Tente novamente mais tarde.",
    over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    email_address_not_authorized: "O envio de e-mails ainda está restrito à equipe. Entre em contato conosco.",
    email_address_invalid: "Digite um e-mail válido.",
    signup_disabled: "O cadastro está temporariamente indisponível.",
    user_already_exists: "Não foi possível concluir o cadastro. Tente entrar ou recuperar sua senha.",
    otp_expired: "O link expirou ou já foi utilizado. Solicite um novo link.",
    session_not_found: "Sua sessão expirou. Entre novamente.",
    refresh_token_not_found: "Sua sessão expirou. Entre novamente.",
  };
  if (messages[error?.code]) return messages[error.code];
  if (error?.status === 429) return messages.over_request_rate_limit;
  if (error instanceof TypeError || error?.name === "AuthRetryableFetchError") {
    return "Não foi possível conectar. Confira sua internet e tente novamente.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

// Só campos de exibição. Metadados editáveis NUNCA definem papel/permissão.
// A autorização dos dados na EC2 será feita pelo backend, validando o JWT.
export function toDisplayUser(user) {
  if (!user?.id) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    name: typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name.trim().slice(0, 120)
      : "",
  };
}

export async function registerUser({ name, email, password }) {
  const { data, error } = await authClient().signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { name: name.trim() },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
  if (error) throw error;
  // Com confirmação de e-mail ativa, session é null. Não simular login.
  return { needsConfirmation: !data.session };
}

export async function loginUser({ email, password }) {
  const { data, error } = await authClient().signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data.session;
}

export async function logoutUser() {
  // Encerra a sessão deste navegador, mantendo outros dispositivos.
  const { error } = await authClient().signOut({ scope: "local" });
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const { error } = await authClient().resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/login` },
  );
  if (error) throw error;
}

export async function changePassword(password) {
  const { error } = await authClient().updateUser({ password });
  if (error) throw error;
}

export function removeLegacyAuth() {
  // Remove somente as duas chaves da antiga simulação com senhas em texto.
  // Não apaga preferências, protocolos nem a sessão gerenciada pelo SDK.
  try {
    window.localStorage.removeItem("aw_users");
    window.localStorage.removeItem("aw_current_user");
  } catch {
    // Navegadores podem bloquear o armazenamento; isso não autentica ninguém.
  }
}
