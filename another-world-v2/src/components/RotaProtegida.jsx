import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// "Porteiro" de rota: envolve uma página que só pode ser vista por quem
// está logado. Se não tiver usuário na sessão, manda pro /login em vez
// de mostrar a página (ou de dar tela branca).
//
// O replace evita que a pessoa consiga "voltar" no navegador pra rota
// protegida — ela seria jogada pro login de novo, num vai-e-volta chato.
export default function RotaProtegida({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
