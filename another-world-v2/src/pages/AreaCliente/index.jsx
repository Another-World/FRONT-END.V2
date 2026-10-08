import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authErrorMessage } from "../../services/auth";
import { sincronizarPerfil, atualizarPerfil } from "../../services/perfil";
import Button from "../../components/ui/Button";

export default function AreaCliente() {
  const { user, logout } = useAuth();
  if (!user) return null;
  // Ao trocar de conta, desmontar a interface anterior e limpar seus dados.
  return <AreaDaConta key={user.id} user={user} logout={logout} />;
}

function AreaDaConta({ user, logout }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erroPerfil, setErroPerfil] = useState("");
  const [avisoPerfil, setAvisoPerfil] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [form, setForm] = useState({ nome: "", telefone: "", empresa: "" });
  const salvamento = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let ativo = true;

    // Fora do callback onAuthStateChange: não bloquear o SDK do Supabase.
    sincronizarPerfil(user.id, controller.signal).then((dados) => {
      if (!ativo) return;
      setPerfil(dados);
      setForm({ nome: dados.nome, telefone: dados.telefone ?? "", empresa: dados.empresa ?? "" });
    }).catch((err) => {
      if (ativo) setErroPerfil(err.message);
    }).finally(() => {
      if (ativo) setCarregando(false);
    });

    return () => {
      ativo = false;
      controller.abort();
      salvamento.current?.abort();
    };
  }, [user.id, tentativa]);

  async function handleSalvar(event) {
    event.preventDefault();
    if (salvamento.current || !perfil) return;
    const controller = new AbortController();
    salvamento.current = controller;
    setSalvando(true);
    setErroPerfil("");
    setAvisoPerfil("");
    try {
      const dados = await atualizarPerfil(user.id, {
        nome: form.nome.trim(),
        telefone: form.telefone.trim() || null,
        empresa: form.empresa.trim() || null,
      }, controller.signal);
      if (controller.signal.aborted) return;
      setPerfil(dados);
      setForm({ nome: dados.nome, telefone: dados.telefone ?? "", empresa: dados.empresa ?? "" });
      setAvisoPerfil("Seus dados foram salvos.");
    } catch (err) {
      if (!controller.signal.aborted) setErroPerfil(err.message);
    } finally {
      if (!controller.signal.aborted) setSalvando(false);
      if (salvamento.current === controller) salvamento.current = null;
    }
  }

  function alterarCampo(event) {
    const { name, value } = event.target;
    setForm((anterior) => ({ ...anterior, [name]: value }));
    setAvisoPerfil("");
  }

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
            <h1 className="text-3xl font-bold text-text-main">Seja bem-vindo, {perfil?.nome || user.name || user.email}!</h1>
            <p className="mt-2 text-sm text-text-muted">Seu espaço na Another World.</p>
          </div>
          <button type="button" disabled={busy} onClick={handleLogout} className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-text-muted transition hover:border-purple hover:text-text-main disabled:opacity-60">
            {busy ? "Saindo…" : "Sair da conta"}
          </button>
        </div>

        {error && <p className="mb-6 text-sm text-text-main" role="alert">{error}</p>}

        <section className="mb-12 rounded-2xl border border-border bg-bg-card p-8">
          <h2 className="mb-6 text-lg font-semibold text-text-main">Dados da conta</h2>
          {carregando && <p className="text-sm text-text-muted" role="status">Carregando seus dados…</p>}
          {erroPerfil && <p className="mb-4 text-sm text-text-main" role="alert">{erroPerfil}</p>}
          {!carregando && !perfil && (
            <Button type="button" variant="outline" onClick={() => {
              setCarregando(true);
              setErroPerfil("");
              setTentativa((valor) => valor + 1);
            }}>
              Tentar novamente
            </Button>
          )}
          {perfil && !carregando && (
            <form onSubmit={handleSalvar}>
              <fieldset disabled={salvando || busy} className="grid gap-6 disabled:opacity-70 sm:grid-cols-2">
                <CampoPerfil label="Nome" name="nome" value={form.nome} onChange={alterarCampo} required maxLength={120} autoComplete="name" />
                <Dado label="E-mail da conta" valor={perfil.email} />
                <CampoPerfil label="Telefone (opcional)" name="telefone" type="tel" value={form.telefone} onChange={alterarCampo} maxLength={25} autoComplete="tel" />
                <CampoPerfil label="Empresa (opcional)" name="empresa" value={form.empresa} onChange={alterarCampo} maxLength={160} autoComplete="organization" />
                <div className="sm:col-span-2">
                  <Button type="submit" variant="solid">{salvando ? "Salvando…" : "Salvar dados"}</Button>
                </div>
              </fieldset>
              {avisoPerfil && <p className="mt-4 text-sm text-text-main" role="status">{avisoPerfil}</p>}
            </form>
          )}
        </section>

        {/* Próxima etapa: ler as solicitações pela API protegida.
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

function CampoPerfil({ label, name, ...props }) {
  return (
    <div>
      <label htmlFor={`perfil-${name}`} className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</label>
      <input id={`perfil-${name}`} name={name} {...props} className="w-full rounded-xl border border-border bg-bg-dark px-4 py-3 text-text-main outline-none focus:border-purple focus:ring-2 focus:ring-purple/30" />
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
