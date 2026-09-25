// ⚠️ SIMULAÇÃO:
// As solicitações ficam no localStorage deste navegador.
// Quando tivermos backend (Supabase), este arquivo será
// o principal ponto a ser alterado.

const KEY = "aw_solicitacoes";


// Estados possíveis de uma solicitação.
export const STATUS = {
  EM_ANALISE: "em_analise",
  ACEITO: "aceito",
  NEGADO: "negado",
};


// Texto e estilo de cada status.
export const STATUS_INFO = {
  [STATUS.EM_ANALISE]: {
    label: "Em Análise",
    classe:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },

  [STATUS.ACEITO]: {
    label: "Aceito",
    classe:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },

  [STATUS.NEGADO]: {
    label: "Negado",
    classe:
      "border-red-500/30 bg-red-500/10 text-red-300",
  },
};


function lerTudo() {
  const raw = localStorage.getItem(KEY);

  return raw ? JSON.parse(raw) : [];
}


function salvarTudo(lista) {
  localStorage.setItem(KEY, JSON.stringify(lista));
}


// Todas as solicitações.
export function getSolicitacoes() {
  return lerTudo().sort(
    (a, b) =>
      b.criadaEm.localeCompare(a.criadaEm)
  );
}


// Solicitações de um cliente.
export function getSolicitacoesPorEmail(email) {
  return getSolicitacoes().filter(
    (solicitacao) =>
      solicitacao.email === email
  );
}


// Cria uma nova solicitação.
export function criarSolicitacao({
  nome,
  email,
  telefone,
  cep,
  endereco,
  frente,
  mensagem,
  pessoaJuridica = false,
  cnpj = "",
}) {
  const nova = {
    id: crypto.randomUUID(),

    nome,
    email,
    telefone: telefone ?? "",

    cep: cep ?? "",
    endereco: endereco ?? "",

    // Tipo de serviço solicitado.
    frente: frente ?? "Ainda não sei",

    mensagem,

    // Dados da empresa.
    pessoaJuridica: Boolean(pessoaJuridica),

    // Só guarda CNPJ se for Pessoa Jurídica.
    cnpj: pessoaJuridica
      ? cnpj ?? ""
      : "",

    status: STATUS.EM_ANALISE,

    resposta: "",

    criadaEm: new Date().toISOString(),
  };


  salvarTudo([
    ...lerTudo(),
    nova,
  ]);


  return nova;
}


// Atualiza o status de uma solicitação.
export function atualizarStatus(
  id,
  status,
  resposta = ""
) {
  const lista = lerTudo().map(
    (solicitacao) =>
      solicitacao.id === id
        ? {
            ...solicitacao,
            status,
            resposta,
            respondidaEm:
              new Date().toISOString(),
          }
        : solicitacao
  );


  salvarTudo(lista);
}