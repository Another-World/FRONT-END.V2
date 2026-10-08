import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authErrorMessage } from "../../services/auth";
import Button from "../../components/ui/Button";

export default function AreaCliente() {
  const { user, logout } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  async function handleLogout() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await logout();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-dark">
      <div className="mx-auto max-w-[1100px] px-6 py-16">
        <div className="mb-12 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-purple">Área do Cliente</p>
            <h1 className="text-3xl font-bold text-text-main">Seja bem-vindo, {user.name || user.email}!</h1>
            <p className="mt-2 text-sm text-text-muted">Seu espaço na Another World.</p>
          </div>
          <button type="button" disabled={busy} onClick={handleLogout} className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-text-muted transition hover:border-purple hover:text-text-main disabled:opacity-60">
            {busy ? "Saindo…" : "Sair da conta"}
          </button>
        </div>

        {error && <p className="mb-6 text-sm text-text-main" role="alert">{error}</p>}

        <section className="mb-12 rounded-2xl border border-border bg-bg-card p-8">
          <h2 className="mb-6 text-lg font-semibold text-text-main">Dados da conta</h2>
          <dl className="grid gap-6 sm:grid-cols-2">
            <Dado label="Nome" valor={user.name} />
            <Dado label="E-mail" valor={user.email} />
          </dl>
        </section>

        {/* Próxima etapa: ler o perfil e as solicitações pela API protegida.
            Não ler pedidos do localStorage nem buscar clientes por e-mail
            fornecido pelo navegador. O backend usará o JWT verificado. */}
        <section className="rounded-2xl border border-border bg-bg-card p-8">
          <h2 className="mb-4 text-lg font-semibold text-text-main">Minhas solicitações</h2>
          <p className="mb-3 text-sm text-text-muted">O acompanhamento de solicitações nesta área estará disponível em breve.</p>
          <p className="mb-6 text-sm text-text-muted">Se você já enviou um pedido, guarde o protocolo exibido no envio. O formulário de contato continua disponível para novas solicitações.</p>
          <Button as={Link} to="/contato" variant="solid">Fazer uma solicitação</Button>
        </section>
      </div>
    </div>
  );
}

function Dado({ label, valor }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="break-words text-text-main">{valor || "—"}</dd>
    </div>
  );
}
