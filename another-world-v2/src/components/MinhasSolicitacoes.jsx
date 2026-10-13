import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listarSolicitacoes, STATUS_INFO } from "../services/solicitacoes";
import Button from "./ui/Button";

const formatarData = valor => new Date(valor).toLocaleString("pt-BR");

export default function MinhasSolicitacoes({ usuarioId, habilitado }) {
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
