import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listarSolicitacoes, STATUS, STATUS_INFO } from "../services/solicitacoes";
import {
  consultarMinhaAvaliacao,
  criarMinhaAvaliacao,
  STATUS_AVALIACAO,
} from "../services/avaliacoes";
import Button from "./ui/Button";

const formatarData = valor => new Date(valor).toLocaleString("pt-BR");

export default function MinhasSolicitacoes({ usuarioId, habilitado, podeAvaliar }) {
  const [pagina, setPagina] = useState({ solicitacoes: [], proximoCursor: null });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const requisicao = useRef(null);

  useEffect(() => {
    if (!habilitado) return;
    const controller = new AbortController();
    requisicao.current = controller;
    listarSolicitacoes(usuarioId, { signal: controller.signal }).then(resultado => {
      if (!controller.signal.aborted) setPagina(resultado);
    }).catch(error => {
      if (!controller.signal.aborted) setErro(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setCarregando(false);
      if (requisicao.current === controller) requisicao.current = null;
    });
    return () => {
      controller.abort();
      requisicao.current?.abort();
      requisicao.current = null;
    };
  }, [usuarioId, habilitado, tentativa]);

  function atualizar() {
    if (requisicao.current) return;
    setCarregando(true);
    setErro("");
    setTentativa(valor => valor + 1);
  }

  async function carregarMais() {
    if (requisicao.current || !pagina.proximoCursor) return;
    const controller = new AbortController();
    requisicao.current = controller;
    setCarregando(true);
    setErro("");
    try {
      const resultado = await listarSolicitacoes(usuarioId, {
        cursor: pagina.proximoCursor, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setPagina(anterior => ({
        solicitacoes: [...new Map([...anterior.solicitacoes, ...resultado.solicitacoes]
          .map(item => [item.id, item])).values()],
        proximoCursor: resultado.proximoCursor,
      }));
    } catch (error) {
      if (!controller.signal.aborted) setErro(error.message);
    } finally {
      if (!controller.signal.aborted) setCarregando(false);
      if (requisicao.current === controller) requisicao.current = null;
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-bg-card p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-main">Minhas solicitações</h2>
        <button type="button" disabled={!habilitado || carregando} onClick={atualizar}
          className="text-sm text-purple hover:underline disabled:opacity-50">Atualizar</button>
      </div>
      <p className="mb-6 text-sm text-text-muted">Aqui aparecem os pedidos enviados enquanto você estava conectado à sua conta.</p>
      {habilitado && carregando && <p className="mb-4 text-sm text-text-muted" role="status">Consultando seus pedidos…</p>}
      {erro && <div className="mb-4">
        <p role="alert" className="mb-2 text-sm text-text-main">{erro}</p>
        <button type="button" disabled={carregando} onClick={atualizar}
          className="text-sm text-purple hover:underline">Tentar novamente</button>
      </div>}
      {habilitado && !carregando && !erro && pagina.solicitacoes.length === 0
        && <p className="mb-6 text-sm text-text-muted">Você ainda não tem solicitações vinculadas à sua conta.</p>}
      {pagina.solicitacoes.length > 0 && <ul className="mb-6 space-y-4">
        {pagina.solicitacoes.map(item => {
          const status = STATUS_INFO[item.status];
          return <li key={item.id} className="rounded-xl border border-border bg-bg-dark/30 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-text-main">{item.servico.nome}</h3>
              <span className={`rounded-full border px-3 py-1 text-xs ${status.classe}`}>{status.label}</span>
            </div>
            <p className="break-all text-xs text-text-muted">Protocolo: {item.id}</p>
            <p className="mt-2 text-xs text-text-muted">Enviado em {formatarData(item.criadaEm)}</p>
            <p className="mt-1 text-xs text-text-muted">Atualizado em {formatarData(item.atualizadaEm)}</p>
            {item.status === STATUS.CONCLUIDA && podeAvaliar
              && <AvaliacaoSolicitacao usuarioId={usuarioId} solicitacaoId={item.id} />}
          </li>;
        })}
      </ul>}
      <div className="flex flex-wrap gap-3">
        <Button as={Link} to="/contato" variant="solid">Fazer uma solicitação</Button>
        {pagina.proximoCursor && <Button type="button" variant="outline" disabled={carregando}
          onClick={carregarMais}>Carregar mais</Button>}
      </div>
    </section>
  );
}

const campoAvaliacao = "w-full rounded-xl border border-border bg-bg-dark px-4 py-3 text-sm text-text-main outline-none focus:border-purple focus:ring-2 focus:ring-purple/30";

function AvaliacaoSolicitacao({ usuarioId, solicitacaoId }) {
  const [avaliacao, setAvaliacao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [nota, setNota] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [sugestoes, setSugestoes] = useState("");
  const envio = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    consultarMinhaAvaliacao(usuarioId, solicitacaoId, controller.signal)
      .then((resultado) => {
        if (!controller.signal.aborted) setAvaliacao(resultado);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setErro(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false);
      });
    return () => {
      controller.abort();
      envio.current?.abort();
    };
  }, [usuarioId, solicitacaoId, tentativa]);

  function tentarNovamente() {
    setCarregando(true);
    setErro("");
    setTentativa((valor) => valor + 1);
  }

  async function enviar(event) {
    event.preventDefault();
    if (salvando || nota < 1) return;
    if (!window.confirm(
      "Enviar esta avaliação? A nota e os textos não poderão ser editados depois.",
    )) return;
    const controller = new AbortController();
    envio.current = controller;
    setSalvando(true);
    setErro("");
    try {
      const resultado = await criarMinhaAvaliacao(usuarioId, {
        solicitacaoId,
        nota,
        observacoes: observacoes.trim(),
        sugestoes: sugestoes.trim(),
      }, controller.signal);
      if (!controller.signal.aborted) setAvaliacao(resultado);
    } catch (error) {
      if (!controller.signal.aborted) setErro(error.message);
    } finally {
      if (!controller.signal.aborted) setSalvando(false);
      if (envio.current === controller) envio.current = null;
    }
  }

  if (carregando) return <div className="mt-5 border-t border-border pt-5">
    <p className="text-sm text-text-muted" role="status">Consultando avaliação…</p>
  </div>;

  if (erro && !avaliacao) return <div className="mt-5 border-t border-border pt-5">
    <p className="text-sm text-text-main" role="alert">{erro}</p>
    <button type="button" onClick={tentarNovamente}
      className="mt-2 text-sm text-purple hover:underline">Tentar novamente</button>
  </div>;

  if (avaliacao) return <div className="mt-5 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 className="font-semibold text-text-main">Sua avaliação</h4>
      <span className="rounded-full border border-purple/40 bg-purple/10 px-3 py-1 text-xs text-purple">
        {STATUS_AVALIACAO[avaliacao.status]}
      </span>
    </div>
    <p className="mt-3 text-xl text-amber-300" aria-label={`${avaliacao.nota} de 5 estrelas`}>
      {"★".repeat(avaliacao.nota)}
      <span aria-hidden="true" className="text-text-muted/40">{"★".repeat(5 - avaliacao.nota)}</span>
    </p>
    {avaliacao.observacoes && <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Observações</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-main">{avaliacao.observacoes}</p>
    </div>}
    {avaliacao.sugestoes && <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Sugestões</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-main">{avaliacao.sugestoes}</p>
    </div>}
    <p className="mt-4 text-xs text-text-muted">Enviada em {formatarData(avaliacao.criadaEm)}.</p>
  </div>;

  return <form onSubmit={enviar} className="mt-5 border-t border-border pt-5">
    <fieldset disabled={salvando} className="space-y-5 disabled:opacity-60">
      <legend className="font-semibold text-text-main">Avalie este atendimento</legend>
      <div>
        <p className="mb-2 text-sm text-text-muted">Escolha uma nota de 1 a 5</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Nota da avaliação">
          {[1, 2, 3, 4, 5].map((valor) => <button key={valor} type="button"
            role="radio" aria-checked={nota === valor}
            aria-label={`${valor} ${valor === 1 ? "estrela" : "estrelas"}`}
            onClick={() => setNota(valor)}
            className={`rounded-lg border px-3 py-2 text-2xl transition ${
              valor <= nota
                ? "border-amber-400 bg-amber-400/10 text-amber-300"
                : "border-border text-text-muted hover:border-purple"
            }`}>★</button>)}
        </div>
        {nota > 0 && <p className="mt-2 text-xs text-text-muted">Nota selecionada: {nota} de 5.</p>}
      </div>
      <label className="block text-sm text-text-muted">Observações (opcional)
        <textarea className={`${campoAvaliacao} mt-2`} rows="4" maxLength="2000"
          value={observacoes} onChange={(event) => setObservacoes(event.target.value)}
          placeholder="Conte como foi o atendimento." />
      </label>
      <label className="block text-sm text-text-muted">Sugestões (opcional)
        <textarea className={`${campoAvaliacao} mt-2`} rows="3" maxLength="2000"
          value={sugestoes} onChange={(event) => setSugestoes(event.target.value)}
          placeholder="O que poderíamos melhorar?" />
      </label>
      {erro && <p className="text-sm text-text-main" role="alert">{erro}</p>}
      <Button type="submit" variant="solid" disabled={nota < 1 || salvando}>
        {salvando ? "Enviando…" : "Enviar avaliação"}
      </Button>
      <p className="text-xs text-text-muted">
        Depois do envio, a nota e os textos não poderão ser editados.
      </p>
    </fieldset>
  </form>;
}
