// Gera exemplos locais com dados fictícios. Não consulta banco nem envia e-mail.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gerarPropostaPdf } from "../src/propostaPdf.js";

const pasta = process.argv[2] ? resolve(process.argv[2]) :
  fileURLToPath(new URL("../.previews/propostas/", import.meta.url));
const exemplo = {
  id: "a7c4e930-3ca4-4a4b-8d7e-70e2a9b8c531",
  solicitacaoId: "c6d89240-a845-4def-9a03-d5ff27a98d12",
  cliente: {
    nome: "Marina Costa", empresa: "Horizonte Estúdio | Exemplo fictício",
    email: "marina@example.com", telefone: "(11) 99999-0000",
  },
  descricao: "Redes | Estruturação da rede do escritório",
  escopo: "Levantamento dos pontos de rede e diagnóstico da infraestrutura existente.\n\nConfiguração do roteador e de até dois pontos de acesso, com organização das redes de colaboradores e visitantes.\n\nTestes de conectividade e entrega de um resumo das configurações realizadas.",
  valorCentavos: 285000,
  prazo: "5 dias úteis após a confirmação e liberação do acesso ao local.",
  condicoes: "Pagamento: 50% na confirmação e 50% na conclusão.\nEquipamentos e materiais não estão incluídos neste valor. Alterações de escopo serão orçadas separadamente.",
  validade: "2026-11-05", criadaEm: "2026-10-21T12:00:00.000Z", versao: 0,
};
await mkdir(pasta, { recursive: true });
await writeFile(join(pasta, "proposta-profissional-exemplo.pdf"), await gerarPropostaPdf(exemplo));
const extensa = {
  ...exemplo,
  descricao: "Desenvolvimento web | Portal institucional com apresentação dos serviços e área de atendimento",
  escopo: Array.from({ length: 18 }, (_, i) =>
    `${String(i + 1).padStart(2, "0")}. Etapa de demonstração: levantamento de requisitos, implementação, validação com a equipe e registro dos ajustes. Este conteúdo fictício verifica a continuidade do documento em mais de uma página, preservando a leitura do escopo e a identificação da proposta.`
  ).join("\n\n"),
  condicoes: exemplo.condicoes + "\n\n" + Array.from({ length: 8 }, (_, i) =>
    `Condição ilustrativa ${i + 1}: os detalhes de execução serão avaliados conforme o conteúdo comercial informado pela equipe. Exemplo fictício para validação de paginação, sem criar condições padrão nas propostas reais.`
  ).join("\n\n"),
};
await writeFile(join(pasta, "proposta-profissional-extensa.pdf"), await gerarPropostaPdf(extensa));
console.log(`Prévias fictícias geradas em: ${pasta}`);
