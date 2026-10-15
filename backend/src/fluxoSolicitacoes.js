const fluxo = {
  em_analise: ["em_contato", "aceito", "negado", "cancelada"],
  em_contato: ["em_analise", "aceito", "negado", "cancelada"],
  aceito: ["em_analise", "em_contato", "concluida", "cancelada"],
  negado: ["em_analise"],
  concluida: ["em_analise"],
  cancelada: ["em_analise"],
};
export const STATUS_SOLICITACOES = Object.freeze(Object.keys(fluxo));

export function identificarAcao(anterior, novo) {
  if (["negado", "concluida", "cancelada"].includes(anterior) && novo === "em_analise") return "reabertura";
  return { aceito: "aceite", negado: "recusa", cancelada: "cancelamento", concluida: "conclusao" }[novo] ?? "andamento";
}

const confirmacoes = {
  reabertura: "Reabrir esta solicitação e voltar para Em análise? A reabertura ficará registrada no histórico.",
  aceite: "Aceitar esta solicitação para preparar um orçamento? Isso não representa contratação pelo cliente.",
  recusa: "Recusar esta solicitação? A decisão ficará registrada no histórico.",
  cancelamento: "Cancelar esta solicitação? A decisão ficará registrada no histórico.",
  conclusao: "Marcar esta solicitação como concluída? A decisão ficará registrada no histórico.",
};

export function acoesDisponiveis(status) {
  return (fluxo[status] ?? []).map(novo => ({
    status: novo, confirmacao: confirmacoes[identificarAcao(status, novo)] ?? null,
  }));
}
