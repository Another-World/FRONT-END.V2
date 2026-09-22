// ⚠️ SIMULAÇÃO: as solicitações ficam no localStorage, ou seja, só existem
// NESTE navegador. Quando tivermos backend (Supabase), este arquivo vira o
// único lugar a mudar — as telas continuam iguais, só trocam essas funções
// por chamadas à API.

const KEY = "aw_solicitacoes";

// Os três estados possíveis de uma solicitação.
export const STATUS = {
  EM_ANALISE: "em_analise",
  ACEITO: "aceito",
  NEGADO: "negado",
};

// Texto e cor de cada status, num lugar só — assim a tela não precisa ter
// um monte de if espalhado pra decidir como mostrar cada um.
export const STATUS_INFO = {
  [STATUS.EM_ANALISE]: {
    label: "Em Análise",
    classe: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  [STATUS.ACEITO]: {
    label: "Aceito",
    classe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  [STATUS.NEGADO]: {
    label: "Negado",
    classe: "border-red-500/30 bg-red-500/10 text-red-300",
  },
};

function lerTudo() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

function salvarTudo(lista) {
  localStorage.setItem(KEY, JSON.stringify(lista));
}

// Todas as solicitações (é isso que o painel do admin vai usar depois).
export function getSolicitacoes() {
  return lerTudo().sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

// Só as de um cliente — é o que aparece na Área do Cliente.
export function getSolicitacoesPorEmail(email) {
  return getSolicitacoes().filter((s) => s.email === email);
}

// Chamada pelo formulário da página de Contato.
// Toda solicitação nova nasce "Em Análise" — não existe estado inicial
// diferente disso.
export function criarSolicitacao({ nome, email, telefone, cep, endereco, frente, mensagem }) {
  const nova = {
    id: crypto.randomUUID(),
    nome,
    email,
    telefone: telefone ?? "",
    cep: cep ?? "",
    endereco: endereco ?? "",
    frente: frente ?? "Ainda não sei",
    mensagem,
    status: STATUS.EM_ANALISE,
    resposta: "",
    criadaEm: new Date().toISOString(),
  };

  salvarTudo([...lerTudo(), nova]);
  return nova;
}

// Usada pelo painel do admin pra aceitar ou negar.
// A "resposta" é a justificativa que o cliente vai ler.
export function atualizarStatus(id, status, resposta = "") {
  const lista = lerTudo().map((s) =>
    s.id === id ? { ...s, status, resposta, respondidaEm: new Date().toISOString() } : s
  );
  salvarTudo(lista);
}
