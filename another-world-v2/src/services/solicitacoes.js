import { obterSessaoApi } from "./sessaoApi";

// Na publicação, o endereço será definido nas variáveis da Vercel.
// No desenvolvimento local, o valor vazio mantém o proxy do Vite.
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? ""
).trim().replace(/\/+$/, "");

export const SERVICOS_ORCAMENTO = [
  { slug: "hardware", nome: "Hardware" },
  { slug: "redes", nome: "Redes" },
  { slug: "desenvolvimento-web", nome: "Desenvolvimento Web" },
  { slug: "manutencao", nome: "Manutenção" },
  { slug: "outro", nome: "Outro / Ainda não sei" },
];

export const STATUS = {
  EM_ANALISE: "em_analise",
  EM_CONTATO: "em_contato",
  ACEITO: "aceito",
  NEGADO: "negado",
  CONCLUIDA: "concluida",
  CANCELADA: "cancelada",
};

export const STATUS_INFO = {
  [STATUS.EM_ANALISE]: {
    label: "Em análise",
    classe: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  [STATUS.EM_CONTATO]: {
    label: "Em contato",
    classe: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
  [STATUS.ACEITO]: {
    label: "Aceito",
    classe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  [STATUS.NEGADO]: {
    label: "Negado",
    classe: "border-red-500/30 bg-red-500/10 text-red-300",
  },
  [STATUS.CONCLUIDA]: {
    label: "Concluída",
    classe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  [STATUS.CANCELADA]: {
    label: "Cancelada",
    classe: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  },
};

function opcional(valor) {
  const texto = String(valor ?? "").trim();
  return texto || undefined;
}

// Guardamos apenas chave e hash na sessão, sem os campos pessoais do formulário.
// Uma resposta perdida pode ser recuperada ao repetir os mesmos dados.
const TENTATIVA_KEY = "aw_contato_tentativa";
let tentativaEmMemoria = null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODIGO_SOLICITACAO = /^(OS|RED|WEB|MAN|OUT|SOL)-\d{4}-\d{4,}$/;

async function obterChaveEnvio(corpo, usuarioId) {
  if (!globalThis.crypto?.randomUUID || !globalThis.crypto?.subtle) {
    throw new Error("Abra o site por HTTPS ou localhost para enviar a solicitação.");
  }
  const bytes = new TextEncoder().encode(usuarioId ? `${usuarioId}\n${corpo}` : corpo);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  let anterior = tentativaEmMemoria;
  try {
    anterior = JSON.parse(sessionStorage.getItem(TENTATIVA_KEY) ?? "null") ?? anterior;
  } catch {
    // Navegadores que bloqueiam armazenamento usam a memória da página.
  }
  if (anterior?.hash === hash && UUID.test(anterior.chave ?? "")) {
    tentativaEmMemoria = anterior;
    return anterior.chave;
  }
  tentativaEmMemoria = { chave: crypto.randomUUID(), hash };
  try {
    sessionStorage.setItem(TENTATIVA_KEY, JSON.stringify(tentativaEmMemoria));
  } catch {
    // A tentativa continua protegida enquanto a página estiver aberta.
  }
  return tentativaEmMemoria.chave;
}

function finalizarTentativa(chave) {
  if (tentativaEmMemoria?.chave === chave) tentativaEmMemoria = null;
  try {
    const armazenada = JSON.parse(sessionStorage.getItem(TENTATIVA_KEY) ?? "null");
    if (armazenada?.chave === chave) sessionStorage.removeItem(TENTATIVA_KEY);
  } catch {
    // O formulário continua funcionando sem sessionStorage.
  }
}

export async function criarSolicitacao(dados, usuarioId = null) {
  const sessao = await obterSessaoApi(usuarioId);
  const payload = {
    nome: dados.nome.trim(),
    email: dados.email.trim().toLowerCase(),
    telefone: dados.telefone.replace(/\D/g, ""),
    servicoSlug: dados.servicoSlug,
    // Envia os dados da empresa para os campos já existentes na API.
    ...(dados.pessoaJuridica === true ? {
      pessoaJuridica: true,
      cnpj: String(dados.cnpj ?? "").trim(),
    } : {}),
    cep: dados.cep.replace(/\D/g, ""),
    logradouro: opcional(dados.rua),
    bairro: opcional(dados.bairro),
    cidade: opcional(dados.cidade),
    uf: opcional(dados.uf)?.toUpperCase(),
    numero: opcional(dados.numero),
    complemento: opcional(dados.complemento),
    mensagem: dados.mensagem.trim(),
    canalPreferido: dados.canalPreferido ?? "email",
    whatsappAutorizado: dados.whatsappAutorizado === true,
  };
  const corpo = JSON.stringify(payload);
  const chave = await obterChaveEnvio(corpo, usuarioId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  let resultado;
  try {
    response = await fetch(`${API_BASE_URL}/api/solicitacoes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": chave,
        ...(sessao ? { Authorization: `Bearer ${sessao.access_token}` } : {}),
      },
      body: corpo,
      signal: controller.signal,
    });
    resultado = await response.json().catch(() => null);
  } catch {
    // Não apaga a chave: o servidor pode ter gravado antes da conexão cair.
    throw new Error(
      "Não foi possível confirmar o envio. Tente novamente com os mesmos dados para recuperar sua solicitação.",
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    if (response.status === 409) finalizarTentativa(chave);
    const error = new Error(
      resultado?.erro ?? "Não foi possível enviar. Tente novamente em instantes.",
    );
    error.campos = Array.isArray(resultado?.campos) ? resultado.campos : [];
    throw error;
  }
  if (!resultado?.id || !CODIGO_SOLICITACAO.test(resultado.codigo ?? "") || resultado.status !== STATUS.EM_ANALISE) {
    throw new Error("O servidor não confirmou o envio. Tente novamente com os mesmos dados.");
  }
  await obterSessaoApi(usuarioId);
  finalizarTentativa(chave);
  return resultado;
}

export async function listarSolicitacoes(usuarioId, { cursor, signal } = {}) {
  const sessao = await obterSessaoApi(usuarioId, true);
  const parametros = new URLSearchParams({ limite: "20" });
  if (cursor) parametros.set("cursor", cursor);
  const timeout = AbortSignal.timeout(15000);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/solicitacoes?${parametros}`, {
      headers: { Authorization: `Bearer ${sessao.access_token}` },
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Não foi possível consultar seus pedidos. Verifique a conexão e tente novamente.", { cause: error });
  }
  const resultado = await response.json().catch(() => null);
  if (!response.ok) throw new Error(resultado?.erro || "Não foi possível consultar seus pedidos.");
  if (!Array.isArray(resultado?.solicitacoes) || resultado.solicitacoes.length > 20
    || !(resultado.proximoCursor === null || typeof resultado.proximoCursor === "string")
    || resultado.solicitacoes.some(item => !UUID.test(item?.id ?? "")
      || !CODIGO_SOLICITACAO.test(item?.codigo ?? "")
      || !STATUS_INFO[item.status] || typeof item.servico?.nome !== "string"
      || !Number.isFinite(Date.parse(item.criadaEm)))) {
    throw new Error("A API não confirmou a lista de solicitações.");
  }
  await obterSessaoApi(usuarioId, true);
  return resultado;
}
