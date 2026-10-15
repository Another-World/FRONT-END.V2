import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sincronizarPerfil } from "../services/perfil";
import RotaProtegida from "./RotaProtegida";

export default function RotaAdmin({ children }) {
  return <RotaProtegida><ContaAdministrativa>{children}</ContaAdministrativa></RotaProtegida>;
}

function ContaAdministrativa({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return null;
  // Troca de conta ou de página desmonta conteúdo e respostas anteriores.
  return <VerificarPermissao key={`${user.id}:${pathname}`} usuarioId={user.id}>{children}</VerificarPermissao>;
}

function VerificarPermissao({ usuarioId, children }) {
  const [estado, setEstado] = useState({ carregando: true, perfil: null, erro: "" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let controller;
    function consultar() {
      controller?.abort();
      const atual = new AbortController();
      controller = atual;
      sincronizarPerfil(usuarioId, atual.signal).then(perfil => {
        if (!atual.signal.aborted) setEstado({ carregando: false, perfil, erro: "" });
      }).catch(error => {
        if (!atual.signal.aborted) setEstado({ carregando: false, perfil: null, erro: error.message });
      });
    }
    function retomar() {
      if (document.visibilityState !== "visible") return;
      consultar();
    }
    consultar();
    window.addEventListener("focus", retomar);
    document.addEventListener("visibilitychange", retomar);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", retomar);
      document.removeEventListener("visibilitychange", retomar);
    };
  }, [usuarioId, tentativa]);

  if (estado.carregando) {
    return <p role="status" className="px-6 py-20 text-center text-text-muted">Verificando sua permissão administrativa…</p>;
  }
  if (estado.erro || estado.perfil?.papel !== "admin") {
    return <section className="mx-auto max-w-xl px-6 py-20 text-text-main">
      <h1 className="mb-4 text-2xl font-bold">Acesso ao painel administrativo</h1>
      <p role="alert">{estado.erro || "Esta conta não possui permissão administrativa."}</p>
      <div className="mt-6 flex flex-wrap gap-5">
        <Link to="/area-cliente" className="text-purple underline">Minha conta</Link>
        <button type="button" className="text-purple underline" onClick={() => {
          setEstado({ carregando: true, perfil: null, erro: "" });
          setTentativa(valor => valor + 1);
        }}>Verificar novamente</button>
      </div>
    </section>;
  }
  // O perfil vem da API autenticada; não usar role/metadata do navegador.
  // Cada endpoint administrativo continua revalidando a autorização no banco.
  return children;
}
