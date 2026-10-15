import { PDFDocument } from "pdfkit";
import { fileURLToPath } from "node:url";
const fonte = fileURLToPath(
  new URL("../assets/fonts/DejaVuSans.ttf", import.meta.url),
);
const moeda = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n / 100,
  );
const data = (s) =>
  s ? s.slice(0, 10).split("-").reverse().join("/") : "Não definida";
export async function gerarPropostaPdf(o) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 112, bottom: 70, left: 50, right: 50 },
    font: fonte,
    bufferPages: true,
    info: {
      Title: `Proposta comercial ${o.id}`,
      Author: "Another World",
      Subject: "Proposta de prestação de serviços",
    },
  });
  const chunks = [];
  const pronto = new Promise((resolve, reject) => {
    doc.on("data", (b) => chunks.push(b));
    doc.once("end", () => resolve(Buffer.concat(chunks)));
    doc.once("error", reject);
  });
  try {
    function cabecalho() {
      doc.save().rect(0, 0, doc.page.width, 86).fill("#251331");
      doc
        .fillColor("#ffffff")
        .fontSize(21)
        .text("ANOTHER WORLD", 50, 23, { lineBreak: false });
      doc
        .fillColor("#d6b5ef")
        .fontSize(10)
        .text("PROPOSTA COMERCIAL | Serviços de tecnologia", 50, 55, {
          lineBreak: false,
        });
      doc.restore();
      doc.x = 50;
      doc.y = 112;
      doc.fontSize(10).fillColor("#2c2631");
    }
    doc.x = 50;
    doc.y = 112;
    doc.fontSize(10).fillColor("#2c2631");
    function secao(t, conteudo) {
      if (doc.y > doc.page.height - 155) doc.addPage();
      doc.moveDown(0.7).fontSize(11).fillColor("#67368a").text(t);
      doc
        .moveDown(0.35)
        .fontSize(10)
        .fillColor("#2c2631")
        .text(conteudo, { width: doc.page.width - 100, lineGap: 3 });
    }
    doc
      .fontSize(9)
      .fillColor("#62566b")
      .text(
        `Proposta: ${o.id}\nSolicitação: ${o.solicitacaoId}\nEmissão: ${data(new Date(o.criadaEm).toISOString())}`,
        { lineGap: 3 },
      );
    secao(
      "CLIENTE",
      [o.cliente.nome, o.cliente.empresa, o.cliente.email, o.cliente.telefone]
        .filter(Boolean)
        .join("\n"),
    );
    secao("SERVIÇO", o.descricao);
    secao("ESCOPO", o.escopo);
    secao("INVESTIMENTO", `${moeda(o.valorCentavos)} (BRL)`);
    secao("PRAZO ESTIMADO", o.prazo);
    secao(
      "CONDIÇÕES COMERCIAIS",
      o.condicoes || "Não foram informadas condições adicionais.",
    );
    secao("VALIDADE DA PROPOSTA", data(o.validade));
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      cabecalho();
      const y = doc.page.height - 43;
      doc
        .save()
        .strokeColor("#ddd4e5")
        .moveTo(50, y - 12)
        .lineTo(doc.page.width - 50, y - 12)
        .stroke();
      doc
        .fillColor("#75647f")
        .fontSize(8)
        .text("Another World | Proposta comercial", 50, y, {
          lineBreak: false,
        });
      doc.text(`${i + 1} / ${range.count}`, doc.page.width - 98, y, {
        lineBreak: false,
      });
      doc.restore();
    }
    doc.end();
  } catch (e) {
    doc.destroy(e);
  }
  return pronto;
}
