import { obterSessaoApi } from "./sessaoApi";
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STATUS_ORCAMENTO = {
  rascunho: "Rascunho",
  aguardando_envio: "Aguardando confirmação do e-mail",
  enviada: "Enviada manualmente",
  aceita: "Aceita pelo cliente (registro da equipe)",
  recusada: "Recusada pelo cliente (registro da equipe)",
};
const valido = (o) =>
  o &&
  UUID.test(o.id ?? "") &&
  UUID.test(o.solicitacaoId ?? "") &&
  STATUS_ORCAMENTO[o.status] &&
  Number.isInteger(o.versao) &&
  o.versao >= 0 &&
  Number.isInteger(o.valorCentavos) &&
  o.valorCentavos > 0 &&
  typeof o.descricao === "string";
async function requisitar(
  uid,
  path = "",
  { method = "GET", body, chave, signal, pdf = false } = {},
) {
  const s = await obterSessaoApi(uid, true);
  let r;
  try {
    r = await fetch(`${API_BASE}/api/atendimento/orcamentos${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(chave ? { "Idempotency-Key": chave } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(
      "Não foi possível confirmar a operação. Atualize a lista antes de tentar novamente.",
      { cause: e },
    );
  }
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    const e = new Error(d?.erro ?? "Não foi possível consultar os orçamentos.");
    e.status = r.status;
    throw e;
  }
  const d = pdf ? await r.blob() : await r.json();
  await obterSessaoApi(uid, true);
  if (pdf) {
    if (d.type !== "application/pdf" || d.size < 100)
      throw new Error("A API não retornou um PDF válido.");
    return d;
  }
  return d;
}
function confirmar(d) {
  if (
    !valido(d?.orcamento) ||
    typeof d.orcamento.cliente?.nome !== "string" ||
    typeof d.orcamento.cliente?.email !== "string" ||
    typeof d.orcamento.escopo !== "string" ||
    typeof d.orcamento.prazo !== "string" ||
    typeof d.orcamento.condicoes !== "string" ||
    !(
      d.orcamento.validade === null ||
      /^\d{4}-\d{2}-\d{2}$/.test(d.orcamento.validade)
    )
  )
    throw new Error("A API não confirmou os dados da proposta.");
  return d;
}
export async function listarOrcamentos(
  uid,
  { status, solicitacaoId, cursor, signal } = {},
) {
  const p = new URLSearchParams({ limite: "20" });
  if (status) p.set("status", status);
  if (solicitacaoId) p.set("solicitacaoId", solicitacaoId);
  if (cursor) p.set("cursor", cursor);
  const d = await requisitar(uid, `?${p}`, { signal });
  if (
    !Array.isArray(d?.orcamentos) ||
    d.orcamentos.length > 20 ||
    d.orcamentos.some((o) => !valido(o)) ||
    !(d.proximoCursor === null || typeof d.proximoCursor === "string")
  )
    throw new Error("A API não confirmou a lista de orçamentos.");
  return d;
}
export async function consultarOrcamento(uid, id, signal) {
  const d = confirmar(
    await requisitar(uid, `/${encodeURIComponent(id)}`, { signal }),
  );
  if (d.orcamento.id !== id || !Array.isArray(d.historico))
    throw new Error("Histórico inválido.");
  return d;
}
export async function criarOrcamento(uid, body, chave, signal) {
  return confirmar(
    await requisitar(uid, "", { method: "POST", body, chave, signal }),
  );
}
export async function editarOrcamento(uid, id, body, signal) {
  return confirmar(
    await requisitar(uid, `/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
      signal,
    }),
  );
}
export async function alterarOrcamento(uid, id, body, signal) {
  return confirmar(
    await requisitar(uid, `/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body,
      signal,
    }),
  );
}
export async function enviarOrcamentoEmail(uid, id, body, signal) {
  return confirmar(await requisitar(uid, `/${encodeURIComponent(id)}/email`, {
    method: "POST", body, signal,
  }));
}
export const baixarProposta = (uid, id, signal) =>
  requisitar(uid, `/${encodeURIComponent(id)}/pdf`, { signal, pdf: true });
