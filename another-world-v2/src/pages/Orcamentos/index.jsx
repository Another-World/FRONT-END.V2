import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listarAtendimento } from "../../services/atendimento";
import {
  listarOrcamentos,
  consultarOrcamento,
  criarOrcamento,
  editarOrcamento,
  alterarOrcamento,
  enviarOrcamentoEmail,
  baixarProposta,
  STATUS_ORCAMENTO,
} from "../../services/orcamentos";
import Button from "../../components/ui/Button";
const campo =
  "w-full rounded-xl border border-border bg-bg-dark px-4 py-3 text-sm text-text-main outline-none focus:border-purple";
const caixa = "rounded-2xl border border-border bg-bg-card p-5 space-y-4";
const vazio = {
  descricao: "",
  escopo: "",
  valor: "",
  prazo: "",
  condicoes: "",
  validade: "",
};
const moeda = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n / 100,
  );
const instante = (s) => new Date(s).toLocaleString("pt-BR");
const rotulos = {
  rascunho_criado: "Rascunho criado",
  rascunho_editado: "Rascunho atualizado",
  envio_manual_confirmado: "Envio manual confirmado",
  email_solicitado: "Envio de e-mail solicitado",
  email_aceito_pelo_ses: "E-mail aceito pelo serviço de envio",
  email_aceito_pelo_provedor: "E-mail aceito pelo serviço de envio",
  resposta_registrada: "Resposta do cliente registrada pela equipe",
};
function valorEmCentavos(s) {
  if (!/^\d{1,8}([,.]\d{1,2})?$/.test(s.trim()))
    throw new Error(
      "Informe o valor em reais, sem separador de milhar (ex.: 1500,50).",
    );
  const [inteiro, decimal = ""] = s.trim().replace(",", ".").split(".");
  const n = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  if (n < 1 || n > 1000000000)
    throw new Error("O valor deve estar entre R$ 0,01 e R$ 10.000.000,00.");
  return n;
}
const formulario = (o) => ({
  descricao: o.descricao,
  escopo: o.escopo,
  valor: (o.valorCentavos / 100).toFixed(2).replace(".", ","),
  prazo: o.prazo,
  condicoes: o.condicoes,
  validade: o.validade ?? "",
});
export default function Orcamentos() {
  const { user } = useAuth();
  return user ? <Painel key={user.id} uid={user.id} /> : null;
}
function Painel({ uid }) {
  const [params] = useSearchParams(),
    inicial = params.get("solicitacao") ?? "";
  const [filtro, setFiltro] = useState(""),
    [busca, setBusca] = useState(""),
    [pesquisa, setPesquisa] = useState("");
  const [pagina, setPagina] = useState({ orcamentos: [], proximoCursor: null });
  const [pedidos, setPedidos] = useState({
    solicitacoes: [],
    proximoCursor: null,
  });
  const [solicitacao, setSolicitacao] = useState(inicial),
    [selecionado, setSelecionado] = useState(null),
    [detalhe, setDetalhe] = useState(null);
  const [form, setForm] = useState(vazio),
    [nota, setNota] = useState(""),
    [erro, setErro] = useState(""),
    [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true),
    [ocupado, setOcupado] = useState(false),
    [bloqueado, setBloqueado] = useState(false),
    [revisado, setRevisado] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [rodada, setRodada] = useState(0),
    [pdf, setPdf] = useState(null);
  const chave = useRef(null),
    requisicao = useRef(null),
    mutacao = useRef(null);
  useEffect(
    () => () => {
      requisicao.current?.abort();
      mutacao.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf);
    },
    [pdf],
  );
  function falhou(e) {
    if (e.status === 401 || e.status === 403) {
      setBloqueado(true);
      setDetalhe(null);
      setPagina({ orcamentos: [], proximoCursor: null });
      setPedidos({ solicitacoes: [], proximoCursor: null });
      setPdf(null);
    }
    setErro(e.message);
  }
  useEffect(() => {
    const c = new AbortController();
    requisicao.current = c;
    Promise.all([
      listarOrcamentos(uid, { status: filtro, signal: c.signal }),
      listarAtendimento(uid, {
        status: "aceito",
        busca: pesquisa || undefined,
        signal: c.signal,
      }),
    ])
      .then(([o, s]) => {
        if (!c.signal.aborted) {
          setPagina(o);
          setPedidos(s);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) falhou(e);
      })
      .finally(() => {
        if (!c.signal.aborted) setCarregando(false);
      });
    return () => c.abort();
  }, [uid, filtro, pesquisa, rodada]);
  function atualizar() {
    if (ocupado) return;
    setCarregando(true);
    setErro("");
    setSelecionado(null);
    setDetalhe(null);
    setPdf(null);
    setRevisado(false);
    setBloqueado(false);
    setPendente(false);
    setRodada((n) => n + 1);
  }
  async function abrir(id) {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    setMensagem("");
    setDetalhe(null);
    setPdf(null);
    setSelecionado(id);
    setRevisado(false);
    const c = new AbortController();
    mutacao.current = c;
    try {
      const d = await consultarOrcamento(uid, id, c.signal);
      if (!c.signal.aborted) {
        setDetalhe(d);
        setForm(formulario(d.orcamento));
        setNota("");
        setPendente(false);
      }
    } catch (e) {
      if (!c.signal.aborted) falhou(e);
    } finally {
      if (!c.signal.aborted) setOcupado(false);
    }
  }
  async function executar(fn, sucesso) {
    if (ocupado || bloqueado || pendente) return;
    setOcupado(true);
    setErro("");
    setMensagem("");
    setPdf(null);
    const c = new AbortController();
    mutacao.current = c;
    try {
      const d = await fn(c.signal);
      if (c.signal.aborted) return;
      // Uma nova leitura confirma o resultado e traz o evento persistido.
      const completo = await consultarOrcamento(uid, d.orcamento.id, c.signal);
      const lista = await listarOrcamentos(uid, {
        status: filtro,
        signal: c.signal,
      });
      if (!c.signal.aborted) {
        setDetalhe(completo);
        setForm(formulario(completo.orcamento));
        setSelecionado(completo.orcamento.id);
        setPagina(lista);
        setRevisado(false);
        setMensagem(sucesso);
      }
    } catch (e) {
      if (!c.signal.aborted) {
        setDetalhe(null);
        setRevisado(false);
        setPendente(true);
        falhou(e);
      }
    } finally {
      if (!c.signal.aborted) setOcupado(false);
    }
  }
  async function salvar(e) {
    e.preventDefault();
    let body;
    try {
      body = {
        descricao: form.descricao.trim(),
        escopo: form.escopo.trim(),
        valorCentavos: valorEmCentavos(form.valor),
        prazo: form.prazo.trim(),
        condicoes: form.condicoes.trim(),
        validade: form.validade || null,
      };
      if (
        new TextEncoder().encode(
          JSON.stringify({
            ...body,
            solicitacaoId: solicitacao,
            versao: detalhe?.orcamento.versao ?? 0,
          }),
        ).byteLength > 15000
      ) {
        throw new Error(
          "Os textos da proposta ficaram muito extensos. Reduza o escopo ou as condições comerciais antes de salvar.",
        );
      }
    } catch (e) {
      setErro(e.message);
      return;
    }
    if (detalhe)
      return executar(
        (signal) =>
          editarOrcamento(
            uid,
            detalhe.orcamento.id,
            { ...body, versao: detalhe.orcamento.versao },
            signal,
          ),
        "Rascunho salvo. Revise o PDF antes de enviar.",
      );
    if (!chave.current || chave.current.solicitacao !== solicitacao)
      chave.current = { solicitacao, id: crypto.randomUUID() };
    return executar(
      (signal) =>
        criarOrcamento(
          uid,
          { ...body, solicitacaoId: solicitacao },
          chave.current.id,
          signal,
        ),
      "Rascunho criado. Revise o PDF antes de enviar.",
    );
  }
  async function visualizar() {
    if (ocupado || !detalhe || bloqueado) return;
    setOcupado(true);
    setErro("");
    const c = new AbortController();
    mutacao.current = c;
    try {
      const blob = await baixarProposta(uid, detalhe.orcamento.id, c.signal);
      if (!c.signal.aborted) {
        setPdf(URL.createObjectURL(blob));
        setRevisado(true);
      }
    } catch (e) {
      if (!c.signal.aborted) falhou(e);
    } finally {
      if (!c.signal.aborted) setOcupado(false);
    }
  }
  function status(novo) {
    if (ocupado || !detalhe) return;
    const texto =
      novo === "enviada"
        ? "Confirma que revisou e enviou este PDF ao cliente por um canal externo? Esta ação apenas registra o envio manual e bloqueia a edição."
        : `Confirma o registro de que o cliente ${novo === "aceita" ? "aceitou" : "recusou"} esta proposta? A origem da resposta ficará no histórico.`;
    if (!window.confirm(texto)) return;
    executar(
      (signal) =>
        alterarOrcamento(
          uid,
          detalhe.orcamento.id,
          {
            status: novo,
            versao: detalhe.orcamento.versao,
            confirmado: true,
            ...(novo !== "enviada" ? { nota: nota.trim() } : {}),
          },
          signal,
        ),
      "Ação registrada no histórico.",
    );
  }
  function enviarEmail() {
    if (ocupado || !detalhe || !revisado || mudou || !detalhe.emailDisponivel) return;
    if (!window.confirm("Confirma o envio deste PDF por e-mail ao endereço exibido? A proposta ficará bloqueada e o envio será processado em seguida.")) return;
    executar(signal => enviarOrcamentoEmail(uid, detalhe.orcamento.id, {
      versao: detalhe.orcamento.versao, confirmado: true,
    }, signal), "Envio solicitado. Atualize a proposta para conferir a confirmação do serviço de e-mail.");
  }
  async function mais(tipo) {
    if (ocupado) return;
    setOcupado(true);
    const c = new AbortController();
    mutacao.current = c;
    try {
      if (tipo === "orcamentos") {
        const d = await listarOrcamentos(uid, {
          status: filtro,
          cursor: pagina.proximoCursor,
          signal: c.signal,
        });
        if (!c.signal.aborted)
          setPagina((a) => ({
            orcamentos: [
              ...new Map(
                [...a.orcamentos, ...d.orcamentos].map((o) => [o.id, o]),
              ).values(),
            ],
            proximoCursor: d.proximoCursor,
          }));
      } else {
        const d = await listarAtendimento(uid, {
          status: "aceito",
          busca: pesquisa || undefined,
          cursor: pedidos.proximoCursor,
          signal: c.signal,
        });
        if (!c.signal.aborted)
          setPedidos((a) => ({
            solicitacoes: [
              ...new Map(
                [...a.solicitacoes, ...d.solicitacoes].map((o) => [o.id, o]),
              ).values(),
            ],
            proximoCursor: d.proximoCursor,
          }));
      }
    } catch (e) {
      if (!c.signal.aborted) falhou(e);
    } finally {
      if (!c.signal.aborted) setOcupado(false);
    }
  }
  const o = detalhe?.orcamento;
  const mudou = o && JSON.stringify(form) !== JSON.stringify(formulario(o));
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-text-main">
          Orçamentos e propostas
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Elabore propostas para solicitações aceitas. Revise o PDF, escolha o
          envio disponível e acompanhe a resposta do cliente.
        </p>
      </header>
      {erro && (
        <p role="alert" className="text-red-300">
          {erro}
        </p>
      )}
      {mensagem && (
        <p role="status" className="text-green-300">
          {mensagem}
        </p>
      )}
      <Button type="button" disabled={ocupado} onClick={atualizar}>
        Atualizar lista
      </Button>
      {pendente && (
        <p role="alert">
          Atualize a lista ou reabra uma proposta para confirmar o resultado
          antes de outra alteração.
        </p>
      )}
      {carregando && <p role="status">Carregando orçamentos…</p>}
      {!bloqueado && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <section className={caixa}>
            <h2 className="text-xl text-text-main">Histórico de propostas</h2>
            <label className="block text-sm">
              Status
              <select
                className={campo}
                value={filtro}
                disabled={ocupado || carregando}
                onChange={(e) => {
                  setFiltro(e.target.value);
                  setCarregando(true);
                  setDetalhe(null);
                  setSelecionado(null);
                  setPdf(null);
                }}
              >
                <option value="">Todos</option>
                {Object.entries(STATUS_ORCAMENTO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {!carregando && !pagina.orcamentos.length && (
              <p className="text-sm text-text-muted">
                Nenhum orçamento encontrado.
              </p>
            )}
            <ul className="space-y-3">
              {pagina.orcamentos.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    disabled={ocupado}
                    aria-pressed={selecionado === i.id}
                    onClick={() => abrir(i.id)}
                    className={`${caixa} w-full text-left hover:border-purple`}
                  >
                    <p className="font-semibold text-text-main">
                      {i.descricao}
                    </p>
                    <p className="text-sm text-text-muted">
                      {STATUS_ORCAMENTO[i.status]} · {moeda(i.valorCentavos)}
                    </p>
                    <p className="break-all text-xs text-text-muted">{i.id}</p>
                  </button>
                </li>
              ))}
            </ul>
            {pagina.proximoCursor && (
              <Button
                disabled={ocupado || carregando}
                onClick={() => mais("orcamentos")}
              >
                Mais propostas
              </Button>
            )}
          </section>
          <div className="space-y-6">
            <section className={caixa}>
              <h2 className="text-xl text-text-main">
                {o ? "Proposta selecionada" : "Novo rascunho"}
              </h2>
              <Button
                disabled={ocupado}
                onClick={() => {
                  if (pendente) return;
                  chave.current = null;
                  setSelecionado(null);
                  setDetalhe(null);
                  setForm(vazio);
                  setPdf(null);
                  setErro("");
                  setRevisado(false);
                }}
              >
                Novo orçamento
              </Button>
              {!o && (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (ocupado || carregando) return;
                      setPesquisa(busca.trim());
                      setCarregando(true);
                      setRodada((n) => n + 1);
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      aria-label="Buscar solicitação aceita por nome ou código"
                      disabled={ocupado || carregando}
                      className={campo}
                      type="search"
                      minLength={2}
                      maxLength={120}
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                    />
                    <Button disabled={ocupado || carregando}>
                      Buscar solicitações aceitas
                    </Button>
                  </form>
                  <label className="block text-sm">
                    Solicitação aceita
                    <select
                      className={campo}
                      value={solicitacao}
                      disabled={ocupado || carregando}
                      onChange={(e) => {
                        setSolicitacao(e.target.value);
                        chave.current = null;
                      }}
                    >
                      <option value="">Selecione uma solicitação</option>
                      {inicial &&
                        !pedidos.solicitacoes.some((s) => s.id === inicial) && (
                          <option value={inicial}>Solicitação selecionada</option>
                        )}
                      {pedidos.solicitacoes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nomeContato} · {s.servico.nome} · {s.codigo}
                        </option>
                      ))}
                    </select>
                  </label>
                  {pedidos.proximoCursor && (
                    <Button
                      disabled={ocupado || carregando}
                      onClick={() => mais("pedidos")}
                    >
                      Mais solicitações aceitas
                    </Button>
                  )}
                </>
              )}
              {o && (
                <>
                  <p className="break-all text-xs text-text-muted">
                    Proposta {o.id} · Versão {o.versao}
                  </p>
                  <p>{STATUS_ORCAMENTO[o.status]}</p>
                  {detalhe.email && <p className="text-sm text-text-muted">
                    E-mail: {detalhe.email.status === "enviada" ? "aceito pelo serviço de envio" :
                      detalhe.email.status === "falhou" ? "resultado incerto; solicite conferência à equipe técnica" :
                      detalhe.email.status === "processando" ? "processando" : "na fila"}
                  </p>}
                  <p className="break-words text-sm">
                    Cliente: {o.cliente.nome} · {o.cliente.email}
                  </p>
                  <p className="text-xs">
                    Solicitação: {pedidos.solicitacoes.find((s) => s.id === o.solicitacaoId)?.codigo ?? "Solicitação vinculada"}
                  </p>
                </>
              )}
              <form onSubmit={salvar}>
                <fieldset
                  disabled={
                    ocupado ||
                    carregando ||
                    pendente ||
                    (o && o.status !== "rascunho")
                  }
                  className="space-y-4 disabled:opacity-70"
                >
                  {[
                    ["descricao", "Descrição do serviço", 500, false],
                    ["escopo", "Escopo", 6000, true],
                    ["prazo", "Prazo estimado", 200, false],
                    [
                      "condicoes",
                      "Condições comerciais (opcional)",
                      4000,
                      true,
                    ],
                  ].map(([k, label, max, area]) => (
                    <label key={k} className="block text-sm">
                      {label}
                      {area ? (
                        <textarea
                          className={campo}
                          rows={k === "escopo" ? 5 : 3}
                          required={k !== "condicoes"}
                          maxLength={max}
                          value={form[k]}
                          onChange={(e) => {
                            setForm((a) => ({ ...a, [k]: e.target.value }));
                            setRevisado(false);
                            setPdf(null);
                          }}
                        />
                      ) : (
                        <input
                          className={campo}
                          required
                          maxLength={max}
                          value={form[k]}
                          onChange={(e) => {
                            setForm((a) => ({ ...a, [k]: e.target.value }));
                            setRevisado(false);
                            setPdf(null);
                          }}
                        />
                      )}
                    </label>
                  ))}
                  <label className="block text-sm">
                    Preço total em reais
                    <input
                      className={campo}
                      required
                      inputMode="decimal"
                      placeholder="1500,50"
                      maxLength={12}
                      value={form.valor}
                      onChange={(e) => {
                        setForm((a) => ({ ...a, valor: e.target.value }));
                        setRevisado(false);
                        setPdf(null);
                      }}
                    />
                  </label>
                  <label className="block text-sm">
                    Validade (opcional)
                    <input
                      type="date"
                      className={campo}
                      value={form.validade}
                      onChange={(e) => {
                        setForm((a) => ({ ...a, validade: e.target.value }));
                        setRevisado(false);
                        setPdf(null);
                      }}
                    />
                  </label>
                  {(!o || o.status === "rascunho") && (
                    <Button type="submit" disabled={!o && !solicitacao}>
                      {o ? "Salvar rascunho" : "Criar rascunho"}
                    </Button>
                  )}
                </fieldset>
              </form>
              {o && (
                <div className="space-y-4">
                  <Button disabled={ocupado || mudou} onClick={visualizar}>
                    Visualizar PDF salvo
                  </Button>
                  {mudou && (
                    <p className="text-sm text-text-muted">
                      Salve o rascunho antes de revisar o documento.
                    </p>
                  )}
                  {o.status === "rascunho" && (
                    <>
                      <p className="text-sm text-text-muted">
                        Revise e baixe o PDF. Envie ao cliente pelo canal
                        escolhido e só então confirme o envio abaixo.
                      </p>
                      <Button
                        disabled={ocupado || !revisado || mudou}
                        onClick={() => status("enviada")}
                      >
                        Confirmar envio manual
                      </Button>
                      {detalhe.emailDisponivel && <Button
                        disabled={ocupado || !revisado || mudou || pendente}
                        onClick={enviarEmail}
                      >
                        Enviar PDF por e-mail
                      </Button>}
                    </>
                  )}
                  {o.status === "aguardando_envio" && <p className="text-sm text-text-muted">
                    A proposta está congelada enquanto aguardamos confirmação do serviço de e-mail.
                    Atualize esta tela para ver o resultado.
                  </p>}
                  {o.status === "enviada" && (
                    <>
                      <label className="block text-sm">
                        Origem e observação da resposta do cliente
                        <textarea
                          className={campo}
                          maxLength={1000}
                          value={nota}
                          onChange={(e) => setNota(e.target.value)}
                          placeholder="Ex.: cliente confirmou por e-mail em 15/10."
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          disabled={ocupado || !nota.trim()}
                          onClick={() => status("aceita")}
                        >
                          Registrar aceite do cliente
                        </Button>
                        <Button
                          disabled={ocupado || !nota.trim()}
                          onClick={() => status("recusada")}
                        >
                          Registrar recusa do cliente
                        </Button>
                      </div>
                    </>
                  )}
                  {o.respostaNota && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      Resposta registrada: {o.respostaNota}
                    </p>
                  )}
                </div>
              )}
            </section>
            {pdf && (
              <section className={caixa}>
                <h2 className="text-lg">Prévia do PDF salvo</h2>
                <a
                  href={pdf}
                  download={`proposta-${o?.id}.pdf`}
                  className="text-purple underline"
                >
                  Baixar PDF
                </a>
                <iframe
                  title="Prévia da proposta comercial"
                  src={pdf}
                  className="h-[650px] w-full rounded-lg bg-white"
                />
              </section>
            )}
            {detalhe && (
              <section className={caixa}>
                <h2 className="text-lg">Histórico</h2>
                <ul className="space-y-3">
                  {detalhe.historico.map((e, i) => (
                    <li
                      key={`${e.criadoEm}-${i}`}
                      className="text-sm text-text-muted"
                    >
                      {instante(e.criadoEm)} · {rotulos[e.tipo] ?? e.tipo} ·
                      versão {e.detalhes.versao}
                      {e.detalhes.statusNovo &&
                        ` · ${STATUS_ORCAMENTO[e.detalhes.statusNovo]}`}
                      {e.detalhes.nota && (
                        <p className="whitespace-pre-wrap break-words">
                          {e.detalhes.nota}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <Link to="/admin/solicitacoes" className="text-sm text-purple">
              Voltar às solicitações
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
