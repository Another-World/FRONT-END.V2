import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { PDFDocument } from "pdfkit";
import { dadosPropostaPdf, formatarDataProposta, gerarPropostaPdf } from "../src/propostaPdf.js";

const exemplo = {
  id: "a7c4e930-3ca4-4a4b-8d7e-70e2a9b8c531",
  solicitacaoId: "c6d89240-a845-4def-9a03-d5ff27a98d12",
  cliente: { nome: "José da Conceição", email: "cliente@example.test" },
  descricao: "Redes e infraestrutura", escopo: "Diagnóstico e configuração da rede.",
  valorCentavos: 285050, prazo: "5 dias úteis", condicoes: "Pagamento após a conclusão.",
  validade: "2026-10-23", criadaEm: "2026-10-21T02:00:00Z", versao: 0,
};

// Instrumentar a escrita sem substituir o renderizador: o PDF real é gerado
// e as medidas reais das fontes verificam a área ocupada por cada bloco.
async function renderizar(dados) {
  const original = PDFDocument.prototype.text;
  const blocos = [];
  PDFDocument.prototype.text = function(texto, x, y, opcoes) {
    const altura = this.heightOfString(texto, opcoes);
    blocos.push({ texto, x, y, altura, tamanho: this._fontSize, largura: opcoes.width, pagina: this.page });
    return original.call(this, texto, x, y, opcoes);
  };
  try { return { bytes: await gerarPropostaPdf(dados), blocos }; }
  finally { PDFDocument.prototype.text = original; }
}

test("validade aceita DATE textual e Date sem produzir dia da semana em inglês", () => {
  assert.equal(formatarDataProposta("2026-10-23"), "23/10/2026");
  assert.equal(formatarDataProposta(new Date(2026, 9, 23)), "23/10/2026");
  assert.equal(formatarDataProposta("2028-02-29"), "29/02/2028");
  for (const valor of [null, "", "Fri Oct 23", "2026-02-29", "2026-13-01", new Date(NaN)]) {
    assert.equal(formatarDataProposta(valor), "Não informada");
  }
  assert.equal(formatarDataProposta("2026-10-21T02:00:00Z", true), "20/10/2026");
});

test("DATE mantém o calendário em fusos distintos; emissão usa Brasília", () => {
  const modulo = new URL("../src/propostaPdf.js", import.meta.url).href;
  for (const TZ of ["UTC", "America/Sao_Paulo", "Pacific/Auckland"]) {
    const saida = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { formatarDataProposta } from ${JSON.stringify(modulo)};
      console.log(formatarDataProposta(new Date(2026, 9, 23)));
      console.log(formatarDataProposta("2026-10-21T02:00:00Z", true));
    `], { env: { ...process.env, TZ }, encoding: "utf8" }).trim();
    assert.equal(saida, "23/10/2026\n20/10/2026");
  }
});

test("prévia e anexo projetam os mesmos dados, sem truncar Date nem incluir resposta interna", async () => {
  const o = {
    id: exemplo.id, solicitacao_id: exemplo.solicitacaoId, cliente: exemplo.cliente,
    descricao: exemplo.descricao, escopo: exemplo.escopo, valor_centavos: exemplo.valorCentavos,
    prazo: exemplo.prazo, condicoes: exemplo.condicoes, validade: new Date(2026, 9, 23),
    criada_em: exemplo.criadaEm, versao: 0, status: "rascunho", resposta_nota: "Nota interna privada",
  };
  const previa = dadosPropostaPdf(o);
  assert.equal(dadosPropostaPdf({ ...o, validade_pdf: "2026-10-23" }).validade, "2026-10-23");
  const anexo = dadosPropostaPdf({ ...o, status: "aguardando_envio", versao: 1 });
  assert.ok(previa.validade instanceof Date);
  const a = await renderizar(previa), b = await renderizar(anexo);
  assert.deepEqual(a.blocos.map(v => v.texto), b.blocos.map(v => v.texto));
  const texto = a.blocos.map(v => v.texto).join("\n");
  assert.ok(texto.includes("23/10/2026"));
  assert.ok(!texto.includes("Nota interna privada"));
});

test("PDF curto inclui acentos, valor, datas e rastreabilidade sem página extra de rodapé", async () => {
  const { bytes, blocos } = await renderizar(exemplo);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.equal((bytes.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length, 1);
  const texto = blocos.map(v => v.texto).join("\n");
  for (const esperado of ["José da Conceição", "R$\u00a02.850,50", "23/10/2026", exemplo.id, exemplo.solicitacaoId]) {
    assert.ok(texto.includes(esperado), esperado);
  }
  assert.ok(!texto.includes("undefined"));
});

test("campos extensos paginam com continuidade, sem perdas ou sobreposição de rodapé", async () => {
  const escopo = ("Escopo com ação, conexão e validação de infraestrutura. ").repeat(112).slice(0, 5990) + " FIMESCOPO";
  const condicoes = ("Condição comercial com descrição detalhada e verificação. ").repeat(80).slice(0, 3980) + " FIMCONDICOES";
  const { bytes, blocos } = await renderizar({
    ...exemplo,
    descricao: "Descrição de serviço ".repeat(25).slice(0, 500), escopo, condicoes,
    prazo: "Prazo conforme disponibilidade e liberação do local. ".repeat(4).slice(0, 200),
    valorCentavos: 1000000000,
    cliente: { nome: "Cliente com nome extenso ".repeat(5), empresa: "Empresa de demonstração ".repeat(6),
      email: "a".repeat(220) + "@example.test", telefone: "(11) 99999-0000" },
  });
  const total = (bytes.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
  assert.ok(total >= 3 && total <= 8, `Paginação inesperada: ${total}`);
  const texto = blocos.map(v => v.texto).join("\n");
  assert.ok(texto.includes("(continuação)"));
  const compacto = s => s.replace(/\s/g, "");
  const corpo = blocos.filter(v => v.tamanho === 9.5).map(v => v.texto).join("\n");
  assert.ok(compacto(corpo).includes(compacto(escopo)));
  assert.ok(compacto(corpo).includes(compacto(condicoes)));
  for (const b of blocos) {
    assert.ok(b.x >= 48 && b.x + b.largura <= b.pagina.width - 47, b.texto);
    assert.ok(b.y + b.altura < b.pagina.height - 16, `Fora da página: ${b.texto}`);
    if (b.y >= 106 && b.y < b.pagina.height - 82) {
      assert.ok(b.y + b.altura <= b.pagina.height - 104 + 0.1, `Invadiu rodapé: ${b.texto}`);
    }
  }
  for (const p of new Set(blocos.map(v => v.pagina))) {
    assert.ok(blocos.some(v => v.pagina === p && v.y >= 106 && v.y < p.height - 104));
  }
});

test("proposta sem empresa, telefone, condições ou validade usa rótulos honestos", async () => {
  const { blocos } = await renderizar({ ...exemplo, validade: null, condicoes: "", cliente: { nome: "Cliente" } });
  const texto = blocos.map(v => v.texto).join("\n");
  assert.ok(texto.includes("Não informada"));
  assert.ok(texto.includes("Condições adicionais não informadas."));
  assert.ok(!texto.includes("50%"));
  assert.ok(!texto.includes("CNPJ"));
});
