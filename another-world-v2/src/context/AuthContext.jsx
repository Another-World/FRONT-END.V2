import { createContext, useContext, useEffect, useState } from "react";
// Ler o link antes da inicialização do cliente Supabase.
import {
  recoveryFromLink,
  readRecoveryUser,
  rememberRecoveryUser,
  cleanCallbackErrorUrl,
} from "../lib/authCallback";
import { supabase, supabaseConfigError } from "../lib/supabase";
import {
  registerUser,
  loginUser,
  logoutUser,
  removeLegacyAuth,
  toDisplayUser,
  authErrorMessage,
} from "../services/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState(supabaseConfigError);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    removeLegacyAuth();
    cleanCallbackErrorUrl();
    if (!supabase) return;

    let active = true;
    let revision = 0;
    let linkPending = recoveryFromLink;

    function receiveSession(session, event) {
      if (!active) return;
      const nextUser = toDisplayUser(session?.user);
      const recovering = Boolean(nextUser && (
        event === "PASSWORD_RECOVERY"
        || linkPending
        || readRecoveryUser() === nextUser.id
      ));
      if (nextUser || event === "SIGNED_OUT") linkPending = false;
      rememberRecoveryUser(recovering ? nextUser.id : null);
      setPasswordRecovery(recovering);
      setUser(nextUser);
      setAuthError("");
      setLoading(false);
    }

    // Callback síncrono: não chamar/aguardar outros métodos do SDK aqui.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        revision += 1;
        receiveSession(session, event);
      },
    );

    // getSession restaura a interface; não substitui validação JWT no backend.
    // O contador impede uma resposta antiga de desfazer um logout recente.
    const initialRevision = revision;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || revision !== initialRevision) return;
      if (error) throw error;
      receiveSession(data.session, "INITIAL_SESSION");
    }).catch((error) => {
      if (!active || revision !== initialRevision) return;
      setAuthError(authErrorMessage(error));
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // O evento do Supabase mantém usuário/sessão sincronizados, inclusive
  // atualização de token e saída em outra aba. Não criamos sessão própria.
  function finishRecovery() {
    rememberRecoveryUser(null);
    setPasswordRecovery(false);
  }

  async function login(data) {
    const session = await loginUser(data);
    finishRecovery();
    return session;
  }

  async function logout() {
    await logoutUser();
    finishRecovery();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, authError, passwordRecovery,
      register: registerUser, login, logout, finishRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook e provider ficam juntos para manter os imports atuais do projeto.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
