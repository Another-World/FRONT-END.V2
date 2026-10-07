// Os chamados ficam salvos no localStorage.
// Quando existir um backend, basta trocar este serviço
// pelas chamadas da API.

const KEY = "aw_chamados";

function lerTudo() {
  const raw = localStorage.getItem(KEY);

  return raw ? JSON.parse(raw) : [];
}

function salvarTudo(lista) {
  localStorage.setItem(KEY, JSON.stringify(lista));
}

export function getChamados() {
  return lerTudo().sort((a, b) =>
    b.criadaEm.localeCompare(a.criadaEm)
  );
}

export function getChamadosPorEmail(email) {
  return getChamados().filter(
    (chamado) => chamado.email === email
  );
}

function gerarProtocolo() {
  const agora = new Date();

  const data = agora
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const sufixo = Math.floor(
    1000 + Math.random() * 9000
  );

  return `AW-${data}-${sufixo}`;
}

export function criarChamado(dados) {
  const novoChamado = {
    id: crypto.randomUUID(),
    protocolo: gerarProtocolo(),
    ...dados,
    status: "aberto",
    criadaEm: new Date().toISOString(),
  };

  salvarTudo([
    ...lerTudo(),
    novoChamado,
  ]);

  return novoChamado;
}