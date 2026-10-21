import { obterSessaoApi } from "./sessaoApi";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_SOLICITACAO = /^(OS|RED|WEB|MAN|OUT|SOL)-\d{4}-\d{4,}$/;

async function requisitar(usuarioId, path, signal) {
  const sessao = await obterSessaoApi(usuarioId, true);
  let resposta;
  try {
    resposta = await fetch(`${API_BASE}/api/atendimento/usuarios${path}`, {
      headers: { Authorization: `Bearer ${sessao.access_token}` },
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Não foi possível consultar os usuários. Verifique a conexão.", { cause: error });
  }
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = new Error(dados?.erro || "Não foi possível consultar os usuários.");
    erro.status = resposta.status;
    throw erro;
  }
  await obterSessaoApi(usuarioId, true);
  return dados;
}

const usuarioValido = u => UUID.test(u?.id ?? "") && typeof u.nome === "string"
  && typeof u.email === "string" && typeof u.ativo === "boolean"
  && ["admin", "cliente"].includes(u.papel) && Number.isFinite(Date.parse(u.criadoEm));
const cursorValido = c => c === null || typeof c === "string";

export async function listarUsuariosAdmin(usuarioId, { busca, ativo, cursor, signal } = {}) {
  const q = new URLSearchParams({ limite: "20" });
  if (busca) q.set("busca", busca);
  if (ativo !== "") q.set("ativo", ativo);
  if (cursor) q.set("cursor", cursor);
  const dados = await requisitar(usuarioId, `?${q}`, signal);
  if (!Array.isArray(dados?.usuarios) || dados.usuarios.length > 20
    || dados.usuarios.some(u => !usuarioValido(u)) || !cursorValido(dados.proximoCursor))
    throw new Error("A API retornou uma lista de usuários inválida.");
  return dados;
}

export async function consultarUsuarioAdmin(usuarioId, id, { cursor, signal } = {}) {
  if (!UUID.test(id)) throw new Error("Usuário inválido.");
  const q = new URLSearchParams({ limite: "20" });
  if (cursor) q.set("cursor", cursor);
  const dados = await requisitar(usuarioId, `/${encodeURIComponent(id)}?${q}`, signal);
  if (!usuarioValido(dados?.usuario) || dados.usuario.id !== id
    || !Array.isArray(dados.solicitacoes) || dados.solicitacoes.length > 20
    || dados.solicitacoes.some(s => !UUID.test(s?.id ?? "")
      || !CODIGO_SOLICITACAO.test(s?.codigo ?? "")
      || typeof s.status !== "string" || !Number.isFinite(Date.parse(s.criadaEm)))
    || !cursorValido(dados.proximoCursor))
    throw new Error("A API retornou dados inválidos para este usuário.");
  return dados;
}
