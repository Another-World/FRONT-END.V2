import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { consultarUsuarioAdmin, listarUsuariosAdmin } from "../../services/adminUsuarios";

const campo = "w-full rounded-xl border border-border bg-bg-dark px-4 py-3 text-sm text-text-main outline-none focus:border-purple focus:ring-2 focus:ring-purple/30";
const botao = "rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const data = v => new Date(v).toLocaleString("pt-BR");

export default function Usuarios() {
  const { user } = useAuth();
  if (!user) return null;
  return <Painel key={user.id} usuarioId={user.id} />;
}

function Painel({ usuarioId }) {
  const [filtro, setFiltro] = useState({ busca: "", ativo: "", tentativa: 0 });
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState({ usuarios: [], proximoCursor: null });
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [negado, setNegado] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listarUsuariosAdmin(usuarioId, { ...filtro, signal: controller.signal }).then(dados => {
      if (!controller.signal.aborted) setLista(dados);
    }).catch(e => {
      if (!controller.signal.aborted) {
        if ([401, 403].includes(e.status)) setNegado(true);
        else setErro(e.message);
      }
    }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [usuarioId, filtro]);

  const bloquear = useCallback(() => setNegado(true), []);
  function atualizar(buscaNova = filtro.busca, ativoNovo = filtro.ativo) {
    setLista({ usuarios: [], proximoCursor: null }); setSelecionado(null);
    setErro(""); setCarregando(true);
    setFiltro(anterior => ({ busca: buscaNova, ativo: ativoNovo, tentativa: anterior.tentativa + 1 }));
  }
  async function mais() {
    if (carregando || !lista.proximoCursor) return;
    setCarregando(true); setErro("");
    try {
      const dados = await listarUsuariosAdmin(usuarioId, { ...filtro, cursor: lista.proximoCursor });
      setLista(atual => ({ usuarios: [...atual.usuarios, ...dados.usuarios], proximoCursor: dados.proximoCursor }));
    } catch (e) {
      if ([401, 403].includes(e.status)) setNegado(true);
      else setErro(e.message);
    } finally { setCarregando(false); }
  }

  return <div className="mx-auto w-full max-w-[1440px]">
    <h1 className="text-3xl font-bold text-text-main">Usuários cadastrados</h1>
    <p className="mb-8 mt-2 text-sm text-text-muted">Consulte os perfis sincronizados e suas solicitações vinculadas.</p>
    {negado ? <p role="alert" className="text-text-main">Acesso restrito à equipe de atendimento. Atualize a página para verificar sua permissão.</p> : <>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <form onSubmit={e => { e.preventDefault(); atualizar(busca.trim()); }}>
          <label htmlFor="busca-usuarios" className="mb-2 block text-sm text-text-muted">Nome ou e-mail</label>
          <div className="flex flex-wrap gap-2">
            <input id="busca-usuarios" type="search" minLength={2} maxLength={120} value={busca}
              onChange={e => setBusca(e.target.value)} placeholder="Digite pelo menos 2 caracteres" className={campo} />
            <button className={botao} type="submit" disabled={carregando}>Buscar</button>
            <button className={botao} type="button" disabled={carregando || (!busca && !filtro.busca)}
              onClick={() => { setBusca(""); atualizar(""); }}>Limpar</button>
          </div>
        </form>
        <div>
          <label htmlFor="status-usuarios" className="mb-2 block text-sm text-text-muted">Situação</label>
          <select id="status-usuarios" value={filtro.ativo} disabled={carregando} className={campo}
            onChange={e => atualizar(filtro.busca, e.target.value)}>
            <option value="">Todos</option><option value="true">Ativos</option><option value="false">Desativados</option>
          </select>
        </div>
        <button className={botao} type="button" disabled={carregando} onClick={() => atualizar()}>Atualizar</button>
      </div>
      {carregando && <p role="status" className="mb-4 text-text-muted">Carregando usuários…</p>}
      {erro && <p role="alert" className="mb-4 text-red-300">{erro}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-text-main">Contas</h2>
          {!carregando && !erro && !lista.usuarios.length && <p className="text-text-muted">Nenhum usuário encontrado.</p>}
          <ul className="space-y-3">{lista.usuarios.map(u => <li key={u.id}>
            <button type="button" onClick={() => setSelecionado(u.id)} aria-pressed={selecionado === u.id}
              className={`w-full rounded-xl border p-4 text-left ${selecionado === u.id ? "border-purple" : "border-border hover:border-purple"}`}>
              <span className="font-semibold text-text-main">{u.nome}</span>
              <span className="ml-2 text-xs text-text-muted">{u.ativo ? "Ativo" : "Desativado"}</span>
              <p className="break-all text-sm text-text-muted">{u.email}</p>
              <p className="mt-1 text-xs text-text-muted">{u.papel === "admin" ? "Administrador" : "Cliente"} · {data(u.criadoEm)}</p>
            </button>
          </li>)}</ul>
          {lista.proximoCursor && <button type="button" className={`${botao} mt-5`} disabled={carregando} onClick={mais}>Carregar mais</button>}
        </section>
        {selecionado ? <Detalhe key={selecionado} id={selecionado} usuarioId={usuarioId} bloquear={bloquear} />
          : <section className="rounded-2xl border border-border bg-bg-card p-8 text-sm text-text-muted">Selecione um usuário para consultar seus dados.</section>}
      </div>
    </>}
  </div>;
}

function Detalhe({ id, usuarioId, bloquear }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    consultarUsuarioAdmin(usuarioId, id, { signal: controller.signal }).then(r => {
      if (!controller.signal.aborted) setDados(r);
    }).catch(e => {
      if (!controller.signal.aborted) {
        if ([401, 403].includes(e.status)) bloquear();
        else setErro(e.message);
      }
    }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [id, usuarioId, tentativa, bloquear]);

  async function mais() {
    if (!dados?.proximoCursor || carregando) return;
    setCarregando(true); setErro("");
    try {
      const r = await consultarUsuarioAdmin(usuarioId, id, { cursor: dados.proximoCursor });
      setDados(atual => ({ ...atual, solicitacoes: [...atual.solicitacoes, ...r.solicitacoes], proximoCursor: r.proximoCursor }));
    } catch (e) {
      if ([401, 403].includes(e.status)) bloquear();
      else setErro(e.message);
    } finally { setCarregando(false); }
  }
  return <section className="rounded-2xl border border-border bg-bg-card p-5 text-text-main">
    <h2 className="mb-4 text-lg font-semibold">Detalhes do usuário</h2>
    {carregando && <p role="status" className="text-text-muted">Carregando detalhes…</p>}
    {erro && <p role="alert" className="mb-4 text-red-300">{erro} <button type="button" className="underline" onClick={() => {
      setDados(null); setErro(""); setCarregando(true); setTentativa(n => n + 1);
    }}>Tentar novamente</button></p>}
    {dados && <>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[["Nome", dados.usuario.nome], ["E-mail", dados.usuario.email], ["Telefone", dados.usuario.telefone || "Não informado"],
          ["Empresa", dados.usuario.empresa || "Não informada"], ["Permissão", dados.usuario.papel === "admin" ? "Administrador" : "Cliente"],
          ["Situação", dados.usuario.ativo ? "Ativo" : "Desativado"], ["Cadastro", data(dados.usuario.criadoEm)]].map(([rotulo, valor]) =>
          <div key={rotulo}><dt className="text-text-muted">{rotulo}</dt><dd className="break-words">{valor}</dd></div>)}
      </dl>
      <h3 className="mb-3 mt-7 font-semibold">Solicitações vinculadas</h3>
      {!dados.solicitacoes.length && <p className="text-sm text-text-muted">Nenhuma solicitação vinculada a esta conta.</p>}
      <ul className="space-y-3">{dados.solicitacoes.map(s => <li key={s.id} className="rounded-lg border border-border p-3 text-sm">
        <p>{s.servico} · {s.status.replaceAll("_", " ")}</p>
        <p className="text-text-muted">{data(s.criadaEm)}</p>
        <Link to={`/admin/solicitacoes?pedido=${encodeURIComponent(s.id)}`} className="text-purple underline">Ver solicitação {s.codigo}</Link>
      </li>)}</ul>
      {dados.proximoCursor && <button type="button" className={`${botao} mt-4`} disabled={carregando} onClick={mais}>Carregar mais solicitações</button>}
    </>}
  </section>;
}
