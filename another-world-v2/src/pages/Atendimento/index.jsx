import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { sincronizarPerfil } from "../../services/perfil";
import { listarAtendimento, consultarAtendimento, alterarStatus } from "../../services/atendimento";
import { STATUS_INFO } from "../../services/solicitacoes";
import Button from "../../components/ui/Button";

const data = valor => new Date(valor).toLocaleString("pt-BR");
const vazio = { solicitacoes: [], proximoCursor: null };
const campo = "w-full rounded-xl border border-border bg-bg-dark px-4 py-3 text-sm text-text-main outline-none focus:border-purple focus:ring-2 focus:ring-purple/30";

export default function Atendimento() {
  const { user } = useAuth();
  if (!user) return null;
  return <AcessoAtendimento key={user.id} usuarioId={user.id} />;
}

function AcessoAtendimento({ usuarioId }) {
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [negado, setNegado] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const bloquear = useCallback(() => setNegado(true), []);

  useEffect(() => {
    const controller = new AbortController();
    sincronizarPerfil(usuarioId, controller.signal).then(resultado => {
      if (!controller.signal.aborted) setPerfil(resultado);
    }).catch(error => {
      if (!controller.signal.aborted) setErro(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setCarregando(false);
    });
    return () => controller.abort();
  }, [usuarioId, tentativa]);

  function atualizarAcesso() {
    setPerfil(null); setNegado(false); setErro(""); setCarregando(true);
    setTentativa(v => v + 1);
  }
  return <div className="w-full">
    <div className="mx-auto w-full max-w-[1440px]">
      <Link to="/area-cliente" className="text-sm text-purple hover:underline">← Minha conta</Link>
      <h1 className="mt-6 text-3xl font-bold text-text-main">Solicitações</h1>
      <p className="mt-2 mb-8 text-sm text-text-muted">Acompanhe as solicitações e atualize o andamento de cada pedido.</p>
      {carregando && <p role="status" className="text-text-muted">Verificando seu acesso…</p>}
      {!carregando && (erro || negado || perfil?.papel !== "admin") && <section className="rounded-2xl border border-border bg-bg-card p-8">
        <p role="alert" className="mb-4 text-text-main">{erro || "Acesso restrito à equipe de atendimento. Solicite a liberação ao responsável pelo sistema."}</p>
        <Button type="button" onClick={atualizarAcesso}>Atualizar acesso</Button>
      </section>}
      {!carregando && !erro && !negado && perfil?.papel === "admin"
        && <Painel usuarioId={usuarioId} bloquear={bloquear} />}
    </div>
  </div>;
}

function Painel({ usuarioId, bloquear }) {
  const [consulta, setConsulta] = useState({ status: "", busca: "", tentativa: 0 });
  const [buscaRascunho, setBuscaRascunho] = useState("");
  const [pagina, setPagina] = useState(vazio);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const requisicao = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    requisicao.current = controller;
    listarAtendimento(usuarioId, { status: consulta.status, busca: consulta.busca, signal: controller.signal }).then(resultado => {
      if (!controller.signal.aborted) setPagina(resultado);
    }).catch(error => {
      if (!controller.signal.aborted) {
        if (error.status === 403 || error.status === 401) bloquear();
        else setErro(error.message);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setCarregando(false);
      if (requisicao.current === controller) requisicao.current = null;
    });
    return () => {
      controller.abort(); requisicao.current?.abort(); requisicao.current = null;
    };
  }, [usuarioId, consulta.status, consulta.busca, consulta.tentativa, bloquear]);

  function atualizar(status = consulta.status, busca = consulta.busca) {
    if (salvando) return;
    requisicao.current?.abort(); setCarregando(true); setErro("");
    setPagina(vazio); setSelecionado(null);
    setConsulta(anterior => ({ status, busca, tentativa: anterior.tentativa + 1 }));
  }
  async function mais() {
    if (requisicao.current || !pagina.proximoCursor || salvando) return;
    const controller = new AbortController();
    requisicao.current = controller; setCarregando(true); setErro("");
    try {
      const r = await listarAtendimento(usuarioId, { status: consulta.status, busca: consulta.busca, cursor: pagina.proximoCursor, signal: controller.signal });
      if (!controller.signal.aborted) setPagina(anterior => ({
        solicitacoes: [...new Map([...anterior.solicitacoes, ...r.solicitacoes].map(item => [item.id, item])).values()],
        proximoCursor: r.proximoCursor,
      }));
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error.status === 403 || error.status === 401) bloquear();
        else setErro(error.message);
      }
    } finally {
      if (!controller.signal.aborted) setCarregando(false);
      if (requisicao.current === controller) requisicao.current = null;
    }
  }
  function atualizado(item) {
    setPagina(anterior => ({ ...anterior, solicitacoes: anterior.solicitacoes
      .map(row => row.id === item.id ? { ...row, ...item } : row)
      .filter(row => !consulta.status || row.status === consulta.status) }));
  }
  return <>
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <form onSubmit={event => { event.preventDefault(); atualizar(consulta.status, buscaRascunho.trim()); }}>
        <fieldset disabled={salvando || carregando} className="flex flex-wrap items-end gap-3 disabled:opacity-70">
          <div>
            <label htmlFor="busca-solicitacoes" className="mb-2 block text-sm text-text-muted">Nome ou protocolo</label>
            <input id="busca-solicitacoes" type="search" className={campo} minLength={2} maxLength={120}
              placeholder="Digite pelo menos 2 caracteres" value={buscaRascunho}
              onChange={event => setBuscaRascunho(event.target.value)} />
          </div>
          <Button type="submit">Buscar</Button>
          <Button type="button" disabled={!buscaRascunho && !consulta.busca} onClick={() => {
            setBuscaRascunho(""); atualizar(consulta.status, "");
          }}>Limpar busca</Button>
        </fieldset>
      </form>
      <div className="min-w-[220px]">
        <label htmlFor="filtro-status" className="mb-2 block text-sm text-text-muted">Filtrar por status</label>
        <select id="filtro-status" className={campo} value={consulta.status} disabled={salvando || carregando}
          onChange={event => atualizar(event.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_INFO).map(([valor, info]) => <option key={valor} value={valor}>{info.label}</option>)}
        </select>
      </div>
      <Button type="button" disabled={salvando || carregando} onClick={() => atualizar()}>Atualizar lista</Button>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-text-main">Solicitações</h2>
        {carregando && <p role="status" className="mb-4 text-sm text-text-muted">Carregando pedidos…</p>}
        {erro && <div className="mb-4"><p role="alert" className="mb-3 text-sm text-text-main">{erro}</p>
          <Button type="button" disabled={salvando || carregando} onClick={() => atualizar()}>Tentar novamente</Button></div>}
        {!carregando && !erro && pagina.solicitacoes.length === 0 && <p className="text-sm text-text-muted">Nenhuma solicitação encontrada para este filtro.</p>}
        <ul className="space-y-3">
          {pagina.solicitacoes.map(item => <li key={item.id}>
            <button type="button" disabled={salvando} onClick={() => setSelecionado(item.id)}
              aria-pressed={selecionado === item.id}
              className={`w-full rounded-xl border p-4 text-left transition disabled:opacity-60 ${selecionado === item.id ? "border-purple bg-purple/10" : "border-border bg-bg-dark/30 hover:border-purple"}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-text-main">{item.servico.nome}</span><Selo status={item.status} /></div>
              <p className="text-sm text-text-main">{item.nomeContato}</p>
              <p className="mt-2 break-all text-xs text-text-muted">Protocolo: {item.id}</p>
              <p className="mt-1 text-xs text-text-muted">{data(item.criadaEm)}</p>
            </button>
          </li>)}
        </ul>
        {pagina.proximoCursor && <Button className="mt-5" type="button" disabled={carregando || salvando} onClick={mais}>Carregar mais</Button>}
      </section>
      {selecionado ? <Detalhe key={selecionado} id={selecionado} usuarioId={usuarioId}
        bloquear={bloquear} onAtualizado={atualizado} onSalvando={setSalvando} consultaEmAndamento={carregando} />
        : <section className="rounded-2xl border border-border bg-bg-card p-8 text-sm text-text-muted">Selecione um pedido para ver os dados e atualizar o status.</section>}
    </div>
  </>;
}

function Detalhe({ id, usuarioId, bloquear, onAtualizado, onSalvando, consultaEmAndamento }) {
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novoStatus, setNovoStatus] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [precisaAtualizar, setPrecisaAtualizar] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const alteracao = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    consultarAtendimento(usuarioId, id, controller.signal).then(r => {
      if (!controller.signal.aborted) { setResultado(r); setNovoStatus(r.solicitacao.status); }
    }).catch(error => {
      if (!controller.signal.aborted) {
        if (error.status === 403 || error.status === 401) bloquear();
        else setErro(error.message);
      }
    }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => { controller.abort(); alteracao.current?.abort(); };
  }, [usuarioId, id, tentativa, bloquear]);

  function atualizar() {
    if (salvando) return;
    setCarregando(true); setErro(""); setAviso(""); setPrecisaAtualizar(false);
    setTentativa(v => v + 1);
  }
  async function salvar(event) {
    event.preventDefault();
    if (alteracao.current || !resultado || precisaAtualizar || consultaEmAndamento) return;
    const acao = resultado.solicitacao.acoesDisponiveis.find(item => item.status === novoStatus);
    if (!acao) return;
    if (acao.confirmacao && !window.confirm(acao.confirmacao)) return;
    const controller = new AbortController(); alteracao.current = controller;
    setSalvando(true); onSalvando(true); setErro(""); setAviso("");
    let confirmado = false;
    try {
      const atualizado = await alterarStatus(usuarioId, id, novoStatus, resultado.solicitacao.versao, controller.signal, Boolean(acao.confirmacao));
      if (controller.signal.aborted) return;
      confirmado = true;
      setResultado(anterior => ({ ...anterior, solicitacao: { ...anterior.solicitacao, ...atualizado } }));
      setAviso(acao.confirmacao && novoStatus === "em_analise" ? "Solicitação reaberta e registrada no histórico." : "Status atualizado."); onAtualizado(atualizado);
      const completo = await consultarAtendimento(usuarioId, id, controller.signal);
      if (!controller.signal.aborted) {
        setResultado(completo); setNovoStatus(completo.solicitacao.status); onAtualizado(completo.solicitacao);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error.status === 403 || error.status === 401) bloquear();
        else {
          setErro(confirmado ? "Status salvo. Não foi possível atualizar o histórico; clique em Atualizar detalhes." : error.message);
          if (!confirmado) setPrecisaAtualizar(true);
        }
      }
    } finally {
      if (!controller.signal.aborted) setSalvando(false);
      onSalvando(false);
      if (alteracao.current === controller) alteracao.current = null;
    }
  }
  const item = resultado?.solicitacao;
  return <section className="min-w-0 rounded-2xl border border-border bg-bg-card p-5 sm:p-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-text-main">Detalhes do pedido</h2>
      <button type="button" onClick={atualizar} disabled={salvando || carregando} className="text-sm text-purple hover:underline disabled:opacity-50">Atualizar detalhes</button></div>
    {carregando && <p role="status" className="mb-4 text-sm text-text-muted">Consultando detalhes…</p>}
    {erro && <p role="alert" className="mb-4 text-sm text-text-main">{erro}</p>}
    {aviso && <p role="status" className="mb-4 text-sm text-emerald-300">{aviso}</p>}
    {item && !carregando && <>
      <div className="mb-5 flex flex-wrap gap-3"><h3 className="font-semibold text-text-main">{item.servico.nome}</h3><Selo status={item.status} /></div>
      <p className="mb-5 break-all text-xs text-text-muted">Protocolo: {item.id}</p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dado titulo="Contato" valor={item.nomeContato} />
        <Dado titulo="E-mail" valor={item.contato.email} />
        <Dado titulo="Telefone" valor={item.contato.telefone} />
        <Dado titulo="Canal preferido" valor={item.contato.canalPreferido === "whatsapp" ? "WhatsApp autorizado" : "E-mail"} />
        {item.contato.pessoaJuridica && <><Dado titulo="Empresa" valor={item.contato.empresa} /><Dado titulo="CNPJ" valor={item.contato.cnpj} /></>}
        <Dado titulo="CEP" valor={item.endereco.cep} />
        <Dado titulo="Cidade / UF" valor={[item.endereco.cidade, item.endereco.uf].filter(Boolean).join(" / ")} />
        <Dado className="sm:col-span-2" titulo="Endereço" valor={[item.endereco.logradouro,item.endereco.numero,item.endereco.complemento,item.endereco.bairro].filter(Boolean).join(", ")} />
      </dl>
      <div className="my-6 rounded-xl border border-border bg-bg-dark/30 p-4"><h4 className="mb-2 text-sm font-semibold text-text-main">Mensagem</h4><p className="whitespace-pre-wrap break-words text-sm text-text-muted">{item.mensagem}</p></div>
      <a className="text-sm text-purple hover:underline" href={`mailto:${encodeURIComponent(item.contato.email)}`}>Abrir e-mail do contato</a>
      <form onSubmit={salvar} className="mt-7 border-t border-border pt-6">
        <fieldset disabled={salvando || precisaAtualizar || consultaEmAndamento} className="space-y-4 disabled:opacity-70">
          <label htmlFor="novo-status" className="block text-sm font-semibold text-text-main">Atualizar status</label>
          <select id="novo-status" className={campo} value={novoStatus} onChange={event => setNovoStatus(event.target.value)}>
            <option value={item.status}>{STATUS_INFO[item.status].label} (atual)</option>
            {item.acoesDisponiveis.map(acao => <option key={acao.status} value={acao.status}>{STATUS_INFO[acao.status].label}</option>)}
          </select>
          <Button type="submit" variant="solid" disabled={novoStatus === item.status}>{salvando ? "Salvando…" : "Salvar status"}</Button>
        </fieldset>
        <p className="mt-3 text-xs text-text-muted">Atualizado em {data(item.atualizadaEm)}. A alteração ficará registrada no histórico.</p>
      </form>
      <section className="mt-7 border-t border-border pt-6"><h4 className="mb-4 text-sm font-semibold text-text-main">Histórico recente</h4>
        <ul className="space-y-3">{resultado.historico.map((evento,i) => <li key={`${evento.criadoEm}-${i}`} className="text-xs text-text-muted">
          <p className="text-text-main">{evento.tipo === "status_alterado"
            ? `${evento.detalhes.acao === "reabertura" ? "Solicitação reaberta: " : ""}${STATUS_INFO[evento.detalhes.statusAnterior]?.label ?? "Status anterior"} → ${STATUS_INFO[evento.detalhes.statusNovo]?.label ?? "Novo status"}` : "Solicitação registrada"}</p>
          <p className="mt-1">{data(evento.criadoEm)}</p>
        </li>)}</ul>
      </section>
    </>}
  </section>;
}
function Selo({ status }) {
  const info = STATUS_INFO[status];
  return <span className={`rounded-full border px-3 py-1 text-xs ${info.classe}`}>{info.label}</span>;
}
function Dado({ titulo, valor, className = "" }) {
  return <div className={`min-w-0 ${className}`}><dt className="mb-1 text-xs font-semibold text-text-muted">{titulo}</dt><dd className="break-words text-sm text-text-main">{valor || "—"}</dd></div>;
}
