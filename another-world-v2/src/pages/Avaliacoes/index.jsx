import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "../Admin";
import {
  consultarAvaliacao,
  listarAvaliacoes,
  moderarAvaliacao,
  STATUS_AVALIACAO,
} from "../../services/avaliacoes";

const vazio = {
  avaliacoes: [],
  indicadores: { quantidade: 0, media: null },
  proximoCursor: null,
};
const campo = "w-full rounded-xl border border-[#43265b] bg-[#160b20] px-4 py-3 text-sm text-white outline-none focus:border-[#cda5f2] focus:ring-2 focus:ring-[#7843ab]/40";
const caixa = "rounded-2xl border border-[#43265b] bg-[#1d1028] p-5 sm:p-6";
const formatarData = (valor) => new Date(valor).toLocaleString("pt-BR");
const classesStatus = {
  pendente: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  publicada: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  oculta: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200",
};

function Selo({ status }) {
  return <span className={`rounded-full border px-3 py-1 text-xs ${classesStatus[status]}`}>
    {STATUS_AVALIACAO[status]}
  </span>;
}

function Estrelas({ nota }) {
  return <span aria-label={`${nota} de 5 estrelas`} className="text-amber-300">
    {"★".repeat(nota)}<span aria-hidden="true" className="text-[#624179]">{"★".repeat(5 - nota)}</span>
  </span>;
}

export default function Avaliacoes() {
  const { user } = useAuth();
  if (!user) return null;
  return <Painel key={user.id} usuarioId={user.id} />;
}

function Painel({ usuarioId }) {
  const [filtros, setFiltros] = useState({ status: "", nota: "" });
  const [pagina, setPagina] = useState(vazio);
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const requisicao = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    requisicao.current = controller;
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setCarregando(true);
      setErro("");
      const resultado = await listarAvaliacoes(usuarioId, {
        status: filtros.status,
        nota: filtros.nota,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setPagina(resultado);
    }).catch((error) => {
      if (!controller.signal.aborted) setErro(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setCarregando(false);
      if (requisicao.current === controller) requisicao.current = null;
    });
    return () => {
      controller.abort();
      if (requisicao.current === controller) requisicao.current = null;
    };
  }, [usuarioId, filtros, tentativa]);

  const atualizar = useCallback(() => {
    if (requisicao.current) return;
    setTentativa((valor) => valor + 1);
  }, []);

  async function carregarMais() {
    if (requisicao.current || !pagina.proximoCursor) return;
    const controller = new AbortController();
    requisicao.current = controller;
    setCarregando(true);
    setErro("");
    try {
      const resultado = await listarAvaliacoes(usuarioId, {
        status: filtros.status,
        nota: filtros.nota,
        cursor: pagina.proximoCursor,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setPagina((anterior) => ({
        ...resultado,
        avaliacoes: [...new Map([
          ...anterior.avaliacoes,
          ...resultado.avaliacoes,
        ].map((item) => [item.id, item])).values()],
      }));
    } catch (error) {
      if (!controller.signal.aborted) setErro(error.message);
    } finally {
      if (!controller.signal.aborted) setCarregando(false);
      if (requisicao.current === controller) requisicao.current = null;
    }
  }

  function moderada(item) {
    setPagina((anterior) => ({
      ...anterior,
      avaliacoes: anterior.avaliacoes
        .map((avaliacao) => avaliacao.id === item.id
          ? { ...avaliacao, ...item } : avaliacao)
        .filter((avaliacao) => !filtros.status || avaliacao.status === filtros.status),
    }));
  }

  const semDados = !carregando && !erro && pagina.indicadores.quantidade === 0;
  const semResultado = !carregando && !erro
    && pagina.indicadores.quantidade > 0 && pagina.avaliacoes.length === 0;

  return <div className="mx-auto w-full max-w-[1440px]">
    <header className="mb-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#cda5f2]">
        Another World / Admin
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Avaliações</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#b9a9c7] sm:text-base">
        Consulte as avaliações reais e controle quais podem ser publicadas.
      </p>
    </header>

    {pagina.indicadores.quantidade > 0 && <section
      aria-label="Indicadores de avaliações"
      className="mb-8 grid gap-4 sm:grid-cols-2"
    >
      <article className={caixa}>
        <p className="text-sm text-[#b9a9c7]">Avaliações recebidas</p>
        <p className="mt-3 text-3xl font-bold text-[#cda5f2]">{pagina.indicadores.quantidade}</p>
      </article>
      <article className={caixa}>
        <p className="text-sm text-[#b9a9c7]">Média das notas</p>
        <p className="mt-3 text-3xl font-bold text-[#cda5f2]">
          {pagina.indicadores.media?.toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 2,
          })} <span className="text-base font-normal text-[#b9a9c7]">de 5</span>
        </p>
      </article>
    </section>}

    <section className={`${caixa} mb-6`} aria-label="Filtros de avaliações">
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-[210px] flex-1 text-sm text-[#d8c7df]">
          Status
          <select className={`${campo} mt-2`} value={filtros.status}
            disabled={carregando}
            onChange={(event) => {
              setSelecionado(null);
              setFiltros((anterior) => ({ ...anterior, status: event.target.value }));
            }}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_AVALIACAO).map(([valor, rotulo]) =>
              <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </label>
        <label className="min-w-[210px] flex-1 text-sm text-[#d8c7df]">
          Nota
          <select className={`${campo} mt-2`} value={filtros.nota}
            disabled={carregando}
            onChange={(event) => {
              setSelecionado(null);
              setFiltros((anterior) => ({ ...anterior, nota: event.target.value }));
            }}>
            <option value="">Todas as notas</option>
            {[5, 4, 3, 2, 1].map((nota) =>
              <option key={nota} value={nota}>{nota} {nota === 1 ? "estrela" : "estrelas"}</option>)}
          </select>
        </label>
        <Button type="button" disabled={carregando} onClick={atualizar}>Atualizar</Button>
      </div>
    </section>

    {carregando && pagina.avaliacoes.length === 0 && <EstadoCarregando />}
    {erro && pagina.avaliacoes.length === 0
      && <EstadoErro mensagem={erro} tentarNovamente={atualizar} />}
    {semDados && <EstadoVazio titulo="avaliações"
      mensagem="Ainda não existem avaliações reais. Os indicadores aparecerão após a primeira avaliação." />}
    {semResultado && <EstadoVazio titulo="avaliações"
      mensagem="Existem avaliações, mas nenhuma corresponde aos filtros selecionados." />}

    {pagina.avaliacoes.length > 0 && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className={caixa}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Avaliações encontradas</h2>
          {carregando && <span role="status" className="text-xs text-[#b9a9c7]">Atualizando…</span>}
        </div>
        {erro && <p role="alert" className="mb-4 text-sm text-red-200">{erro}</p>}
        <ul className="space-y-3">
          {pagina.avaliacoes.map((item) => <li key={item.id}>
            <button type="button" onClick={() => setSelecionado(item.id)}
              aria-pressed={selecionado === item.id}
              className={`w-full rounded-xl border p-4 text-left transition ${
                selecionado === item.id
                  ? "border-[#cda5f2] bg-[#7843ab]/15"
                  : "border-[#43265b] bg-[#160b20]/60 hover:border-[#8554b3]"
              }`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Estrelas nota={item.nota} />
                <Selo status={item.status} />
              </div>
              <p className="font-medium text-white">{item.cliente.nome}</p>
              <p className="mt-1 text-sm text-[#b9a9c7]">{item.servico.nome}</p>
              <p className="mt-2 text-xs text-[#9e8baa]">{formatarData(item.criadaEm)}</p>
            </button>
          </li>)}
        </ul>
        {pagina.proximoCursor && <Button className="mt-5" type="button"
          disabled={carregando} onClick={carregarMais}>Carregar mais</Button>}
      </section>
      {selecionado
        ? <Detalhe key={selecionado} id={selecionado} usuarioId={usuarioId} onModerada={moderada} />
        : <section className={`${caixa} text-sm text-[#b9a9c7]`}>
          Selecione uma avaliação para ler o conteúdo e consultar o histórico.
        </section>}
    </div>}
  </div>;
}

function Detalhe({ id, usuarioId, onModerada }) {
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [destino, setDestino] = useState("publicada");
  const [motivo, setMotivo] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setCarregando(true);
      setErro("");
      const dados = await consultarAvaliacao(usuarioId, id, controller.signal);
      if (!controller.signal.aborted) {
        setResultado(dados);
        setDestino(dados.avaliacao.status === "publicada" ? "oculta" : "publicada");
      }
    }).catch((error) => {
      if (!controller.signal.aborted) setErro(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setCarregando(false);
    });
    return () => controller.abort();
  }, [usuarioId, id, tentativa]);

  async function salvar(event) {
    event.preventDefault();
    if (!resultado || salvando || destino === resultado.avaliacao.status) return;
    const acao = destino === "publicada" ? "publicar" : "ocultar";
    if (!window.confirm(`Confirmar a decisão de ${acao} esta avaliação?`)) return;
    const controller = new AbortController();
    setSalvando(true);
    setErro("");
    try {
      const item = await moderarAvaliacao(usuarioId, id, {
        status: destino,
        versao: resultado.avaliacao.versao,
        motivo: motivo.trim(),
        confirmado: true,
      }, controller.signal);
      onModerada(item);
      setMotivo("");
      const atualizado = await consultarAvaliacao(usuarioId, id, controller.signal);
      setResultado(atualizado);
      setDestino(atualizado.avaliacao.status === "publicada" ? "oculta" : "publicada");
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando && !resultado) return <EstadoCarregando />;
  if (erro && !resultado) return <EstadoErro mensagem={erro}
    tentarNovamente={() => setTentativa((valor) => valor + 1)} />;
  if (!resultado) return null;
  const item = resultado.avaliacao;

  return <section className={caixa}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-white">Detalhes da avaliação</h2>
        <p className="mt-1 text-sm text-[#b9a9c7]">Recebida em {formatarData(item.criadaEm)}</p>
      </div>
      <Selo status={item.status} />
    </div>
    {erro && <p role="alert" className="mt-4 text-sm text-red-200">{erro}</p>}

    <dl className="mt-6 grid gap-4 sm:grid-cols-2">
      <div><dt className="text-xs uppercase tracking-wide text-[#9e8baa]">Cliente</dt>
        <dd className="mt-1 break-words text-sm text-white">{item.cliente.nome}<br />{item.cliente.email}</dd></div>
      <div><dt className="text-xs uppercase tracking-wide text-[#9e8baa]">Serviço</dt>
        <dd className="mt-1 text-sm text-white">{item.servico.nome}</dd></div>
      <div><dt className="text-xs uppercase tracking-wide text-[#9e8baa]">Nota</dt>
        <dd className="mt-1"><Estrelas nota={item.nota} /> <span className="text-sm text-white">({item.nota}/5)</span></dd></div>
      <div><dt className="text-xs uppercase tracking-wide text-[#9e8baa]">Solicitação</dt>
        <dd className="mt-1 break-all text-xs text-white">{item.solicitacaoId}</dd></div>
    </dl>

    <div className="mt-6 space-y-5 border-t border-[#43265b] pt-5">
      <div><h3 className="text-sm font-semibold text-white">Observações do cliente</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#d8c7df]">
          {item.observacoes || "O cliente não escreveu observações."}
        </p></div>
      <div><h3 className="text-sm font-semibold text-white">Sugestões do cliente</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#d8c7df]">
          {item.sugestoes || "O cliente não escreveu sugestões."}
        </p></div>
    </div>

    <form onSubmit={salvar} className="mt-6 border-t border-[#43265b] pt-5">
      <fieldset disabled={salvando} className="space-y-4 disabled:opacity-60">
        <legend className="mb-4 text-base font-semibold text-white">Moderação</legend>
        <label className="block text-sm text-[#d8c7df]">Ação
          <select className={`${campo} mt-2`} value={destino}
            onChange={(event) => setDestino(event.target.value)}>
            {item.status !== "publicada" && <option value="publicada">Publicar</option>}
            {item.status !== "oculta" && <option value="oculta">Ocultar</option>}
          </select>
        </label>
        <label className="block text-sm text-[#d8c7df]">Motivo da decisão
          <textarea className={`${campo} mt-2`} rows="3" required minLength="1" maxLength="500"
            value={motivo} onChange={(event) => setMotivo(event.target.value)}
            placeholder="Explique brevemente por que a avaliação será publicada ou ocultada." />
        </label>
        <Button type="submit" disabled={!motivo.trim() || destino === item.status}>
          {salvando ? "Salvando…" : "Confirmar moderação"}
        </Button>
      </fieldset>
      <p className="mt-3 text-xs text-[#9e8baa]">
        A nota e os textos do cliente não podem ser editados. A decisão ficará no histórico.
      </p>
    </form>

    <div className="mt-6 border-t border-[#43265b] pt-5">
      <h3 className="text-base font-semibold text-white">Histórico de moderação</h3>
      {resultado.historico.length === 0
        ? <p className="mt-3 text-sm text-[#b9a9c7]">Ainda não houve moderação.</p>
        : <ul className="mt-4 space-y-4">{resultado.historico.map((evento, indice) =>
          <li key={`${evento.criadoEm}-${indice}`} className="rounded-xl border border-[#43265b] bg-[#160b20]/60 p-4 text-sm">
            <p className="text-white">
              {STATUS_AVALIACAO[evento.statusAnterior]} → {STATUS_AVALIACAO[evento.statusNovo]}
            </p>
            <p className="mt-1 text-[#d8c7df]">{evento.motivo}</p>
            <p className="mt-2 text-xs text-[#9e8baa]">
              {evento.administrador.nome} · {formatarData(evento.criadoEm)}
            </p>
          </li>)}</ul>}
    </div>
  </section>;
}
