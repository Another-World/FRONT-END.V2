import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { consultarDashboard } from "../../services/dashboard";
import { STATUS_INFO } from "../../services/solicitacoes";

const data = valor => new Date(valor).toLocaleString("pt-BR");

function Cartao({ titulo, valor, descricao }) {
  return <article className="rounded-2xl border border-border bg-bg-card p-5">
    <p className="text-sm text-text-muted">{titulo}</p>
    <p className="mt-3 text-3xl font-bold text-purple">{valor}</p>
    <p className="mt-2 text-xs text-text-muted">{descricao}</p>
  </article>;
}

function Selo({ status }) {
  const info = STATUS_INFO[status];
  return <span className={`rounded-full border px-2 py-1 text-xs font-medium ${info.classe}`}>{info.label}</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [estado, setEstado] = useState({ carregando: true, erro: "", dados: null });
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback((signal) => consultarDashboard(user.id, signal)
    .then(dados => { if (!signal.aborted) setEstado({ carregando: false, erro: "", dados }); })
    .catch(error => { if (!signal.aborted) setEstado({ carregando: false, erro: error.message, dados: null }); }), [user.id]);

  useEffect(() => {
    const controller = new AbortController();
    setEstado({ carregando: true, erro: "", dados: null });
    carregar(controller.signal);
    return () => controller.abort();
  }, [carregar, tentativa]);

  const indicadores = estado.dados?.indicadores;
  return <div className="mx-auto w-full max-w-[1440px]">
    <header className="mb-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple">Another World / Admin</p>
      <h1 className="text-3xl font-bold tracking-tight text-text-main sm:text-4xl">Dashboard</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">Visão geral das solicitações e dos orçamentos da plataforma.</p>
    </header>

    {estado.carregando && <p role="status" className="rounded-2xl border border-border bg-bg-card p-8 text-center text-text-muted">Carregando indicadores do dashboard…</p>}
    {estado.erro && <section role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-text-main">
      <p>{estado.erro}</p>
      <button type="button" onClick={() => setTentativa(valor => valor + 1)} className="mt-4 text-sm text-purple underline">Tentar novamente</button>
    </section>}

    {indicadores && <>
      <section aria-label="Indicadores administrativos" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Cartao titulo="Solicitações" valor={indicadores.totalSolicitacoes} descricao="Total registrado" />
        <Cartao titulo="Em análise" valor={indicadores.emAnalise} descricao="Aguardando avaliação da equipe" />
        <Cartao titulo="Aceitas" valor={indicadores.aceitasParaOrcamento} descricao="Prontas para elaboração de orçamento" />
        <Cartao titulo="Recusadas" valor={indicadores.recusadas} descricao="Solicitações negadas" />
        <Cartao titulo="Orçamentos em andamento" valor={indicadores.orcamentosEmAndamento} descricao="Rascunhos, envios pendentes ou enviados" />
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-main">Solicitações recentes</h2>
            <p className="mt-1 text-sm text-text-muted">Os cinco pedidos mais recentes recebidos pela plataforma.</p>
          </div>
          <Link to="/admin/solicitacoes" className="text-sm text-purple hover:underline">Ver todas</Link>
        </div>
        {estado.dados.solicitacoesRecentes.length === 0 ? <p className="py-8 text-center text-sm text-text-muted">Ainda não existem solicitações para exibir.</p>
          : <ul className="divide-y divide-border">
            {estado.dados.solicitacoesRecentes.map(item => <li key={item.id}>
              <Link to={`/admin/solicitacoes?pedido=${item.id}`} className="block py-4 transition hover:bg-bg-dark/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-main">{item.nomeContato}</p>
                    <p className="mt-1 text-sm text-text-muted">{item.servico}</p>
                    <p className="mt-1 text-xs text-text-muted">Solicitação: {item.codigo}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Selo status={item.status} />
                    <time className="text-xs text-text-muted" dateTime={item.criadaEm}>{data(item.criadaEm)}</time>
                  </div>
                </div>
              </Link>
            </li>)}
          </ul>}
      </section>
    </>}
  </div>;
}
