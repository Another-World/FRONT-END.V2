import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// "Porteiro" de rota: envolve uma página que só pode ser vista por quem
// está logado. Se não tiver usuário na sessão, manda pro /login em vez
// de mostrar a página (ou de dar tela branca).
//
// O replace evita que a pessoa consiga "voltar" no navegador pra rota
// protegida — ela seria jogada pro login de novo, num vai-e-volta chato.
export default function RotaProtegida({ children }) {
  const { user, loading, authError, passwordRecovery } = useAuth();

  if (loading) {
    return <p className="px-6 py-20 text-center text-text-muted" role="status">Verificando sua sessão…</p>;
  }

  if (authError) {
    return (
      <div className="px-6 py-20 text-center text-text-main">
        <p role="alert">{authError}</p>
        <button type="button" className="mt-4 text-purple underline" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!user || passwordRecovery) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
