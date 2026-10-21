import { obterSessaoApi } from "./sessaoApi";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_SOLICITACAO = /^(OS|RED|WEB|MAN|OUT|SOL)-\d{4}-\d{4,}$/;

export const STATUS_AVALIACAO = {
  pendente: "Pendente",
  publicada: "Publicada",
  oculta: "Oculta",
};

const resumoValido = (item) => item
  && UUID.test(item.id ?? "")
  && UUID.test(item.solicitacaoId ?? "")
  && CODIGO_SOLICITACAO.test(item.solicitacaoCodigo ?? "")
  && Number.isInteger(item.nota) && item.nota >= 1 && item.nota <= 5
  && STATUS_AVALIACAO[item.status]
  && Number.isInteger(item.versao) && item.versao >= 0
  && typeof item.cliente?.nome === "string"
  && typeof item.servico?.nome === "string"
  && Number.isFinite(Date.parse(item.criadaEm));

const avaliacaoClienteValida = (item, solicitacaoId) => item
  && UUID.test(item.id ?? "")
  && item.solicitacaoId === solicitacaoId
  && Number.isInteger(item.nota) && item.nota >= 1 && item.nota <= 5
  && STATUS_AVALIACAO[item.status]
  && (item.observacoes === null || typeof item.observacoes === "string")
  && (item.sugestoes === null || typeof item.sugestoes === "string")
  && Number.isFinite(Date.parse(item.criadaEm));

async function requisitar(usuarioId, caminho = "", { method = "GET", body, signal } = {}) {
  const sessao = await obterSessaoApi(usuarioId, true);
  let resposta;
  try {
    resposta = await fetch(`${API_BASE}/api/atendimento/avaliacoes${caminho}`, {
      method,
      headers: {
        Authorization: `Bearer ${sessao.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Não foi possível consultar as avaliações. Verifique a conexão e tente novamente.",
      { cause: error },
    );
  }
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const error = new Error(dados?.erro ?? "Não foi possível concluir a operação.");
    error.status = resposta.status;
    throw error;
  }
  await obterSessaoApi(usuarioId, true);
  return dados;
}

async function requisitarCliente(usuarioId, caminho = "", {
  method = "GET", body, signal,
} = {}) {
  const sessao = await obterSessaoApi(usuarioId, true);
  let resposta;
  try {
    resposta = await fetch(`${API_BASE}/api/avaliacoes${caminho}`, {
      method,
      headers: {
        Authorization: `Bearer ${sessao.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Não foi possível acessar a avaliação. Verifique a conexão e tente novamente.",
      { cause: error },
    );
  }
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const error = new Error(dados?.erro ?? "Não foi possível concluir a avaliação.");
    error.status = resposta.status;
    throw error;
  }
  await obterSessaoApi(usuarioId, true);
  return dados;
}

export async function consultarMinhaAvaliacao(usuarioId, solicitacaoId, signal) {
  const dados = await requisitarCliente(
    usuarioId,
    `/solicitacoes/${encodeURIComponent(solicitacaoId)}`,
    { signal },
  );
  if (dados?.avaliacao === null) return null;
  if (!avaliacaoClienteValida(dados?.avaliacao, solicitacaoId))
    throw new Error("A API não confirmou a avaliação desta solicitação.");
  return dados.avaliacao;
}

export async function criarMinhaAvaliacao(usuarioId, dados, signal) {
  const resposta = await requisitarCliente(usuarioId, "", {
    method: "POST",
    body: dados,
    signal,
  });
  if (!avaliacaoClienteValida(resposta?.avaliacao, dados.solicitacaoId))
    throw new Error("A API não confirmou o envio da avaliação.");
  return resposta.avaliacao;
}

export async function listarAvaliacoes(
  usuarioId,
  { status, nota, cursor, signal } = {},
) {
  const parametros = new URLSearchParams({ limite: "20" });
  if (status) parametros.set("status", status);
  if (nota) parametros.set("nota", String(nota));
  if (cursor) parametros.set("cursor", cursor);
  const dados = await requisitar(usuarioId, `?${parametros}`, { signal });
  const indicadoresValidos = Number.isInteger(dados?.indicadores?.quantidade)
    && dados.indicadores.quantidade >= 0
    && (dados.indicadores.media === null
      || (typeof dados.indicadores.media === "number"
        && dados.indicadores.media >= 1 && dados.indicadores.media <= 5));
  if (!Array.isArray(dados?.avaliacoes)
      || dados.avaliacoes.length > 20
      || dados.avaliacoes.some((item) => !resumoValido(item))
      || !indicadoresValidos
      || !(dados.proximoCursor === null || typeof dados.proximoCursor === "string")) {
    throw new Error("A API não confirmou a lista de avaliações.");
  }
  return dados;
}

export async function consultarAvaliacao(usuarioId, id, signal) {
  const dados = await requisitar(usuarioId, `/${encodeURIComponent(id)}`, { signal });
  const item = dados?.avaliacao;
  const textosValidos = (item?.observacoes === null || typeof item?.observacoes === "string")
    && (item?.sugestoes === null || typeof item?.sugestoes === "string")
    && typeof item?.cliente?.email === "string";
  const historicoValido = Array.isArray(dados?.historico)
    && dados.historico.every((evento) =>
      STATUS_AVALIACAO[evento?.statusAnterior]
      && STATUS_AVALIACAO[evento?.statusNovo]
      && typeof evento.motivo === "string"
      && typeof evento.administrador?.nome === "string"
      && Number.isFinite(Date.parse(evento.criadoEm)));
  if (!resumoValido(item) || item.id !== id || !textosValidos || !historicoValido)
    throw new Error("A API não confirmou os detalhes da avaliação.");
  return dados;
}

export async function moderarAvaliacao(usuarioId, id, dados, signal) {
  const resposta = await requisitar(usuarioId, `/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: dados,
    signal,
  });
  const item = resposta?.avaliacao;
  if (!item || item.id !== id || !STATUS_AVALIACAO[item.status]
      || !Number.isInteger(item.versao) || item.versao < 0
      || !Number.isFinite(Date.parse(item.atualizadaEm))) {
    throw new Error("A API não confirmou a moderação.");
  }
  return item;
}
