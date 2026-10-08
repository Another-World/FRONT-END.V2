// Captura o tipo antes de o SDK consumir os parâmetros do link de e-mail.
// Nenhum token é copiado ou salvo por este módulo.
const fragment = new URLSearchParams(window.location.hash.slice(1));
const query = new URLSearchParams(window.location.search);

export const recoveryFromLink = fragment.get("type") === "recovery";
export const callbackError = fragment.has("error") || query.has("error")
  ? "O link expirou ou é inválido. Solicite outro link ou tente entrar novamente."
  : "";

const RECOVERY_KEY = "aw_password_recovery_user";

export function readRecoveryUser() {
  try {
    return window.sessionStorage.getItem(RECOVERY_KEY);
  } catch {
    return null;
  }
}

export function rememberRecoveryUser(id) {
  try {
    if (id) window.sessionStorage.setItem(RECOVERY_KEY, id);
    else window.sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Esta preferência de tela não é uma permissão de acesso.
  }
}

export function cleanCallbackErrorUrl() {
  if (!callbackError) return;
  const url = new URL(window.location.href);
  url.hash = "";
  for (const key of ["error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, "", url);
}
