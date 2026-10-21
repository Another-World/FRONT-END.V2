import { PDFDocument } from "pdfkit";
import { fileURLToPath } from "node:url";

const asset = nome => fileURLToPath(new URL(`../assets/${nome}`, import.meta.url));
const regular = asset("fonts/DejaVuSans.ttf");
const negrito = asset("fonts/DejaVuSans-Bold.ttf");
const logo = asset("another-world-logo.png");
const cores = {
  escuro: "#251331", roxo: "#67368a", texto: "#30263b",
  secundario: "#655a6d", fundo: "#f6f2f8", borda: "#e6dbea",
};
const moeda = valor => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(valor / 100);
const limpar = valor => String(valor ?? "")
  .replace(/\r\n?/g, "\n").replace(/\t/g, "    ")
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
  .replace(/\n{3,}/g, "\n\n").trim();

// DATE do pg pode chegar como Date no fuso local do processo; não converter
// a validade para UTC, nem cortar String(Date), que produz "Fri Oct 23".
export function formatarDataProposta(valor, instante = false) {
  if (valor == null || valor === "") return "Não informada";
  if (instante) {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? "Não informada" :
      new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
  }
  let ano, mes, dia;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return "Não informada";
    ano = valor.getFullYear(); mes = valor.getMonth() + 1; dia = valor.getDate();
  } else {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
    if (!partes) return "Não informada";
    [, ano, mes, dia] = partes.map(Number);
  }
  const validacao = new Date(0);
  validacao.setUTCFullYear(ano, mes - 1, dia);
  if (validacao.getUTCFullYear() !== ano || validacao.getUTCMonth() !== mes - 1 ||
      validacao.getUTCDate() !== dia) return "Não informada";
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${String(ano).padStart(4, "0")}`;
}

// Uma única projeção dos dados persistidos atende tanto a prévia protegida
// quanto o anexo. Status e versão de envio não alteram o conteúdo comercial.
export function dadosPropostaPdf(o) {
  return {
    id: o.id, solicitacaoId: o.solicitacao_id, cliente: o.cliente,
    descricao: o.descricao, escopo: o.escopo, valorCentavos: o.valor_centavos,
    prazo: o.prazo, condicoes: o.condicoes, validade: o.validade_pdf ?? o.validade,
    criadaEm: o.criada_em, versao: o.versao,
  };
}

export async function gerarPropostaPdf(proposta) {
  const doc = new PDFDocument({
    size: "A4", margins: { top: 106, bottom: 104, left: 48, right: 48 },
    font: regular, bufferPages: true,
    info: {
      Title: "Proposta comercial | Another World",
      Author: "Another World", Subject: limpar(proposta.descricao),
      Keywords: "proposta comercial, serviços de tecnologia, Another World",
    },
  });
  const partes = [];
  const pronto = new Promise((resolve, reject) => {
    doc.on("data", parte => partes.push(parte));
    doc.once("end", () => resolve(Buffer.concat(partes)));
    doc.once("error", reject);
  });
  doc.registerFont("Regular", regular).registerFont("Bold", negrito);
  const x = 48, largura = doc.page.width - 96, limite = doc.page.height - 104;
  let y = 112;
  const fonte = (tamanho = 9.5, bold = false) => doc.font(bold ? "Bold" : "Regular").fontSize(tamanho);
  const altura = (t, w, tamanho = 9.5, bold = false) => {
    fonte(tamanho, bold);
    return doc.heightOfString(t, { width: w, lineGap: 2 });
  };
  function escrever(t, px, py, w, tamanho = 9.5, cor = cores.texto, bold = false) {
    fonte(tamanho, bold).fillColor(cor).text(t, px, py, { width: w, lineGap: 2 });
  }
  function pagina() { doc.addPage(); y = 106; }
  function reservar(h) { if (y + h > limite) pagina(); }
  function titulo(numero, nome, continuacao = false) {
    doc.save().roundedRect(x, y, 23, 21, 5).fill(cores.fundo).restore();
    escrever(numero, x + 5, y + 4, 18, 8, cores.roxo, true);
    escrever(nome + (continuacao ? " (continuação)" : ""), x + 34, y + 3,
      largura - 34, 10, cores.escuro, true);
    y += 27;
  }
  function secao(numero, nome, conteudo) {
    let restante = limpar(conteudo);
    reservar(27 + Math.min(altura(restante, largura), 52));
    titulo(numero, nome);
    // Medir o texto antes de desenhar permite repetir o título da seção e
    // manter margens, sem cortar caracteres nem criar títulos órfãos.
    while (restante) {
      const disponivel = limite - y;
      const h = altura(restante, largura);
      if (h <= disponivel) {
        escrever(restante, x, y, largura);
        y += h + 15;
        break;
      }
      const caracteres = Array.from(restante);
      let inicio = 1, fim = caracteres.length, corte = 0;
      while (inicio <= fim) {
        const meio = Math.floor((inicio + fim) / 2);
        if (altura(caracteres.slice(0, meio).join(""), largura) <= disponivel) {
          corte = meio; inicio = meio + 1;
        } else fim = meio - 1;
      }
      if (corte > 0) {
        // Priorizar quebra entre palavras; palavras muito longas são
        // divididas pelo PDFKit dentro da largura disponível.
        let natural = corte;
        while (natural > Math.floor(corte * 0.6) && !/\s/u.test(caracteres[natural - 1])) natural--;
        if (natural > Math.floor(corte * 0.6)) corte = natural;
        const trecho = caracteres.slice(0, corte).join("").trimEnd();
        escrever(trecho, x, y, largura);
        restante = caracteres.slice(corte).join("").trimStart();
      }
      pagina();
      titulo(numero, nome, true);
    }
  }
  function cliente() {
    const c = proposta.cliente ?? {};
    const w = (largura - 60) / 2;
    const nome = limpar(c.nome) || "Cliente não informado";
    const empresa = limpar(c.empresa);
    const contato = [limpar(c.email), limpar(c.telefone)].filter(Boolean).join("\n") || "Contato não informado";
    const hNome = altura(nome, w, 10, true);
    const hEmpresa = empresa ? altura(empresa, w, 9) + 5 : 0;
    const hContato = altura(contato, w, 9);
    const h = Math.max(hNome + hEmpresa, hContato) + 45;
    reservar(h);
    doc.save().roundedRect(x, y, largura, h, 9).lineWidth(0.7).strokeColor(cores.borda).stroke().restore();
    escrever("PREPARADA PARA", x + 18, y + 14, w, 7, cores.roxo, true);
    escrever("CONTATO", x + 42 + w, y + 14, w, 7, cores.roxo, true);
    escrever(nome, x + 18, y + 33, w, 10, cores.texto, true);
    if (empresa) escrever(empresa, x + 18, y + 38 + hNome, w, 9, cores.secundario);
    escrever(contato, x + 42 + w, y + 33, w, 9, cores.secundario);
    y += h + 18;
  }
  function investimento() {
    const prazo = limpar(proposta.prazo) || "Não informado";
    const coluna = (largura - 64) / 2;
    const h = Math.max(80, altura(prazo, coluna, 10) + 51);
    reservar(h + 27);
    titulo("03", "Investimento e prazo");
    doc.save().roundedRect(x, y, largura, h, 9).fill(cores.fundo).restore();
    doc.save().moveTo(x + largura / 2, y + 18).lineTo(x + largura / 2, y + h - 18)
      .lineWidth(0.7).strokeColor(cores.borda).stroke().restore();
    escrever("INVESTIMENTO TOTAL", x + 18, y + 16, coluna, 7, cores.roxo, true);
    const valor = moeda(proposta.valorCentavos);
    let tamanho = 22;
    while (fonte(tamanho, true).widthOfString(valor) > coluna && tamanho > 14) tamanho--;
    escrever(valor, x + 18, y + 35, coluna, tamanho, cores.escuro, true);
    escrever("PRAZO ESTIMADO", x + largura / 2 + 18, y + 16, coluna, 7, cores.roxo, true);
    escrever(prazo, x + largura / 2 + 18, y + 36, coluna, 10);
    y += h + 18;
  }
  function moldura(indice, total) {
    const w = doc.page.width, h = doc.page.height;
    doc.save().rect(0, 0, w, 5).fill(cores.roxo).restore();
    doc.save().roundedRect(x, 28, 51, 51, 10).fill(cores.escuro).restore();
    doc.image(logo, x + 2, 30, { fit: [47, 47] });
    escrever("ANOTHER WORLD", x + 65, 36, 250, 14, cores.escuro, true);
    escrever("SOLUÇÕES EM TECNOLOGIA", x + 65, 59, 250, 7.5, cores.secundario);
    escrever("PROPOSTA\nCOMERCIAL", w - 141, 37, 93, 8, cores.roxo, true);
    doc.save().moveTo(x, 94).lineTo(w - x, 94).lineWidth(0.7).strokeColor(cores.borda).stroke().restore();
    const rodape = h - 82;
    doc.save().moveTo(x, rodape).lineTo(w - x, rodape).lineWidth(0.7).strokeColor(cores.borda).stroke().restore();
    // A referência curta facilita a leitura; UUIDs completos preservam a
    // rastreabilidade sem dominar o conteúdo comercial.
    escrever("Another World  |  Proposta comercial", x, rodape + 11, largura - 100, 7.5, cores.secundario);
    escrever(`${String(indice).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, w - x - 47,
      rodape + 11, 47, 8, cores.roxo, true);
    escrever("Dúvidas ou confirmação: fale com a equipe pelo canal em que recebeu esta proposta.",
      x, rodape + 26, largura, 7, cores.secundario);
    escrever(`Proposta: ${limpar(proposta.id)}`, x, rodape + 40, largura, 6, cores.secundario);
    escrever(`Solicitação: ${limpar(proposta.solicitacaoId)}`, x, rodape + 51, largura, 6, cores.secundario);
  }

  try {
    escrever("Proposta comercial", x, y, largura, 26, cores.escuro, true);
    y += 34;
    escrever("Escopo, investimento e condições de execução.", x, y, largura, 9.5, cores.secundario);
    y += 24;
    const col = largura / 3;
    const campos = [
      ["REFERÊNCIA", `AW-${limpar(proposta.id).slice(0, 8).toUpperCase()}`],
      ["EMISSÃO", formatarDataProposta(proposta.criadaEm, true)],
      ["VALIDADE", formatarDataProposta(proposta.validade)],
    ];
    campos.forEach(([rotulo, valor], i) => {
      escrever(rotulo, x + i * col, y, col - 14, 7, cores.roxo, true);
      escrever(valor, x + i * col, y + 17, col - 14, 10);
    });
    y += 45;
    cliente();
    secao("01", "Serviço proposto", proposta.descricao);
    secao("02", "Escopo do trabalho", proposta.escopo);
    investimento();
    secao("04", "Condições comerciais", limpar(proposta.condicoes) || "Condições adicionais não informadas.");
    const paginas = doc.bufferedPageRange();
    // Rodapés ficam fora da área de fluxo. Desativar a margem inferior só
    // durante a decoração evita páginas extras criadas pela numeração.
    for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      moldura(i - paginas.start + 1, paginas.count);
    }
    doc.end();
  } catch (error) {
    doc.destroy(error);
  }
  return pronto;
}
