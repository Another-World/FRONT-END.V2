import { PDFDocument } from "pdfkit";
import { fileURLToPath } from "node:url";

const fonte = fileURLToPath(new URL("../assets/fonts/DejaVuSans.ttf", import.meta.url));
const logo = fileURLToPath(new URL("../assets/another-world-logo.png", import.meta.url));
const cores = {
  escuro: "#251331", roxo: "#67368a", texto: "#30263b",
  secundario: "#655a6d", fundo: "#f6f2f8", borda: "#e6dbea",
};
const moeda = valor => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(valor / 100);
const data = valor => valor ? String(valor).slice(0, 10).split("-").reverse().join("/") : "Não definida";

export async function gerarPropostaPdf(proposta) {
  const doc = new PDFDocument({
    size: "A4", margins: { top: 130, bottom: 75, left: 50, right: 50 },
    font: fonte, bufferPages: true,
    info: {
      Title: `Proposta comercial ${proposta.id}`,
      Author: "Another World", Subject: "Proposta de prestação de serviços",
    },
  });
  const partes = [];
  const pronto = new Promise((resolve, reject) => {
    doc.on("data", parte => partes.push(parte));
    doc.once("end", () => resolve(Buffer.concat(partes)));
    doc.once("error", reject);
  });

  function secao(titulo, conteudo) {
    const texto = String(conteudo);
    if (doc.y > doc.page.height - 160) doc.addPage();
    doc.fontSize(9).fillColor(cores.roxo).text(titulo, { width: 495 });
    doc.moveDown(0.35);
    doc.fontSize(10).fillColor(cores.texto)
      .text(texto, { width: 495, lineGap: 4 });
    doc.moveDown(1.1);
  }

  function investimento() {
    if (doc.y > doc.page.height - 160) doc.addPage();
    const y = doc.y + 4;
    doc.save().roundedRect(50, y, 495, 82, 10).fill(cores.fundo).restore();
    doc.fontSize(9).fillColor(cores.roxo).text("INVESTIMENTO", 67, y + 15);
    doc.fontSize(22).fillColor(cores.escuro).text(moeda(proposta.valorCentavos), 67, y + 34);
    doc.y = y + 103;
  }

  function moldura(indice, total) {
    const largura = doc.page.width;
    doc.save().rect(0, 0, largura, 103).fill(cores.escuro);
    doc.image(logo, 38, 6, { fit: [90, 90] });
    doc.fontSize(20).fillColor("#ffffff")
      .text("ANOTHER WORLD", 143, 32, { lineBreak: false });
    doc.fontSize(9).fillColor("#d6b5ef")
      .text("PROPOSTA COMERCIAL  |  SERVIÇOS DE TECNOLOGIA", 143, 64, { lineBreak: false });

    const y = doc.page.height - 43;
    doc.strokeColor(cores.borda).moveTo(50, y - 12).lineTo(largura - 50, y - 12).stroke();
    doc.fontSize(8).fillColor(cores.secundario)
      .text("Another World  |  Proposta comercial", 50, y, { lineBreak: false });
    doc.text(`${indice} / ${total}`, largura - 100, y, { lineBreak: false });
    doc.restore();
  }

  try {
    const emitidaEm = data(new Date(proposta.criadaEm).toISOString());
    doc.save().roundedRect(50, 129, 495, 95, 10).fill(cores.fundo).restore();
    doc.fontSize(8).fillColor(cores.secundario).text("IDENTIFICAÇÃO DA PROPOSTA", 67, 143);
    doc.fontSize(9).fillColor(cores.texto).text(proposta.id, 67, 159, { width: 275 });
    doc.fontSize(8).fillColor(cores.secundario).text("EMISSÃO", 393, 143);
    doc.fontSize(10).fillColor(cores.texto).text(emitidaEm, 393, 159);
    doc.fontSize(8).fillColor(cores.secundario).text("SOLICITAÇÃO RELACIONADA", 67, 184);
    doc.fontSize(9).fillColor(cores.texto).text(proposta.solicitacaoId, 67, 199, { width: 450 });
    doc.y = 247;

    secao("CLIENTE", [proposta.cliente.nome, proposta.cliente.empresa,
      proposta.cliente.email, proposta.cliente.telefone].filter(Boolean).join("\n"));
    secao("SERVIÇO", proposta.descricao);
    secao("ESCOPO DO TRABALHO", proposta.escopo);
    investimento();
    secao("PRAZO ESTIMADO", proposta.prazo);
    secao("CONDIÇÕES COMERCIAIS",
      proposta.condicoes || "Não foram informadas condições adicionais.");
    secao("VALIDADE DA PROPOSTA", data(proposta.validade));

    const paginas = doc.bufferedPageRange();
    for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
      doc.switchToPage(i);
      moldura(i - paginas.start + 1, paginas.count);
    }
    doc.end();
  } catch (error) {
    doc.destroy(error);
  }
  return pronto;
}
