import { obterSessaoApi } from "./sessaoApi";
import { STATUS_INFO } from "./solicitacoes";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valido = item => item && UUID.test(item.id ?? "") && STATUS_INFO[item.status]
  && Number.isInteger(item.versao) && item.versao >= 0
  && Number.isFinite(Date.parse(item.atualizadaEm));

async function requisitar(usuarioId, path, { method = "GET", body, signal } = {}) {
  const sessao = await obterSessaoApi(usuarioId, true);
  let response;
  try {
    response = await fetch(`${API_BASE}/api/atendimento/solicitacoes${path}`, {
      method, headers: {
        Authorization: `Bearer ${sessao.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(method === "PATCH"
      ? "Não foi possível confirmar a alteração. Atualize os detalhes antes de tentar novamente."
      : "Não foi possível consultar o atendimento. Verifique a conexão e tente novamente.", { cause: error });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.erro || "Não foi possível concluir o atendimento.");
    error.status = response.status;
    throw error;
  }
  await obterSessaoApi(usuarioId, true);
  return data;
}

export async function listarAtendimento(usuarioId, { status, cursor, signal } = {}) {
  const p = new URLSearchParams({ limite: "20" });
  if (status) p.set("status", status);
  if (cursor) p.set("cursor", cursor);
  const data = await requisitar(usuarioId, `?${p}`, { signal });
  if (!Array.isArray(data?.solicitacoes) || data.solicitacoes.length > 20
      || data.solicitacoes.some(item => !valido(item) || typeof item.nomeContato !== "string" || typeof item.servico?.nome !== "string" || !Number.isFinite(Date.parse(item.criadaEm)))
      || !(data.proximoCursor === null || typeof data.proximoCursor === "string")) {
    throw new Error("A API não confirmou a lista de atendimento.");
  }
  return data;
}
export async function consultarAtendimento(usuarioId, id, signal) {
  const data = await requisitar(usuarioId, `/${encodeURIComponent(id)}`, { signal });
  if (!valido(data?.solicitacao) || data.solicitacao.id !== id
      || typeof data.solicitacao.mensagem !== "string" || !data.solicitacao.contato
      || typeof data.solicitacao.contato.email !== "string" || typeof data.solicitacao.contato.telefone !== "string"
      || !data.solicitacao.endereco || !Array.isArray(data.historico)) {
    throw new Error("A API não confirmou os detalhes do pedido.");
  }
  return data;
}
export async function alterarStatus(usuarioId, id, status, versao, signal) {
  const data = await requisitar(usuarioId, `/${encodeURIComponent(id)}/status`, {
    method: "PATCH", body: { status, versao }, signal,
  });
  if (!valido(data?.solicitacao) || data.solicitacao.id !== id || data.solicitacao.status !== status) {
    throw new Error("A API não confirmou a alteração. Atualize os detalhes do pedido.");
  }
  return data.solicitacao;
}
