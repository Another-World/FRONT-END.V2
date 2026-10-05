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

// Esta função agora é assíncrona: o formulário deve usar await.
// Novas solicitações são gravadas exclusivamente pela API.
export async function criarSolicitacao(dados) {
  const payload = {
    nome: dados.nome.trim(),
    email: dados.email.trim().toLowerCase(),
    telefone: dados.telefone.replace(/\D/g, ""),
    servicoSlug: dados.servicoSlug,
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

  let response;
  try {
    response = await fetch("/api/solicitacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Não foi possível confirmar o envio. Confira sua conexão antes de tentar novamente.",
    );
  }

  const resultado = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      resultado?.erro ?? "Não foi possível enviar. Tente novamente em instantes.",
    );
    error.campos = Array.isArray(resultado?.campos) ? resultado.campos : [];
    throw error;
  }
  if (!resultado?.id || resultado.status !== STATUS.EM_ANALISE) {
    throw new Error("O servidor não confirmou o envio. Confira antes de reenviar.");
  }
  return resultado;
}

// Compatibilidade com as telas de demonstração atuais.
// Estas funções ainda leem SOMENTE dados antigos deste navegador.
// Elas não consultam nem alteram o PostgreSQL. A leitura real dependerá
// da autenticação com Supabase e de novas rotas protegidas do backend.
const KEY = "aw_solicitacoes";

function lerTudo() {
  try {
    const dados = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

export function getSolicitacoes() {
  return lerTudo().sort((a, b) =>
    String(b.criadaEm ?? "").localeCompare(String(a.criadaEm ?? "")),
  );
}

export function getSolicitacoesPorEmail(email) {
  return getSolicitacoes().filter((solicitacao) => solicitacao.email === email);
}

// Apenas para registros antigos de demonstração, sem efeito no banco real.
export function atualizarStatus(id, status, resposta = "") {
  const lista = lerTudo().map((solicitacao) =>
    solicitacao.id === id
      ? { ...solicitacao, status, resposta, respondidaEm: new Date().toISOString() }
      : solicitacao,
  );
  localStorage.setItem(KEY, JSON.stringify(lista));
}
