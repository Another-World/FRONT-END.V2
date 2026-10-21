import { obterSessaoApi } from "./sessaoApi";
import { STATUS_INFO } from "./solicitacoes";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_SOLICITACAO = /^(OS|RED|WEB|MAN|OUT|SOL)-\d{4}-\d{4,}$/;

function indicadorValido(valor) {
  return Number.isInteger(valor) && valor >= 0;
}

function solicitacaoValida(item) {
  return UUID.test(item?.id ?? "") && CODIGO_SOLICITACAO.test(item?.codigo ?? "") && STATUS_INFO[item.status]
    && typeof item.nomeContato === "string" && item.nomeContato.trim().length > 0
    && typeof item.servico === "string" && item.servico.trim().length > 0
    && Number.isFinite(Date.parse(item.criadaEm));
}

export async function consultarDashboard(usuarioId, signal) {
  const sessao = await obterSessaoApi(usuarioId, true);
  let resposta;
  try {
    resposta = await fetch(`${API_BASE}/api/atendimento/dashboard`, {
      headers: { Authorization: `Bearer ${sessao.access_token}` },
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Não foi possível carregar o dashboard. Verifique a conexão.", { cause: error });
  }
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = new Error(dados?.erro || "Não foi possível carregar o dashboard.");
    erro.status = resposta.status;
    throw erro;
  }
  const indicadores = dados?.indicadores;
  if (!indicadores || ![
    indicadores.totalSolicitacoes,
    indicadores.emAnalise,
    indicadores.aceitasParaOrcamento,
    indicadores.recusadas,
    indicadores.orcamentosEmAndamento,
  ].every(indicadorValido) || !Array.isArray(dados.solicitacoesRecentes)
    || dados.solicitacoesRecentes.length > 5
    || dados.solicitacoesRecentes.some(item => !solicitacaoValida(item))) {
    throw new Error("A API retornou dados inválidos para o dashboard.");
  }
  await obterSessaoApi(usuarioId, true);
  return dados;
}
