import assert from "node:assert/strict";
import { test } from "node:test";
import { criarEnvioGmail, htmlMensagem } from "../src/gmail.js";

test("Gmail usa o remetente autorizado, anexa PDF e exige aceite do destinatário", async () => {
  const mensagens = [];
  const enviar = criarEnvioGmail({ usuario: "equipe@gmail.com", senhaApp: "segredo-falso",
    transporte: { sendMail: async (mensagem) => {
      mensagens.push(mensagem);
      return { messageId: "smtp-teste-123", accepted: [mensagem.to], rejected: [] };
    } },
  });
  assert.equal(await enviar({ destinatario: "cliente@example.test", assunto: "Sua proposta",
    conteudo: "Olá, cliente.", anexo: Buffer.from("%PDF-exemplo"),
    nomeArquivo: "proposta.pdf" }), "smtp-teste-123");
  assert.deepEqual(mensagens[0].from, { name: "Another World", address: "equipe@gmail.com" });
  assert.equal(mensagens[0].to, "cliente@example.test");
  assert.equal(mensagens[0].text, "Olá, cliente.");
  assert.match(mensagens[0].html, /cid:logo@another-world\.local/);
  assert.equal(mensagens[0].attachments[0].contentType, "image/png");
  assert.equal(mensagens[0].attachments[0].contentDisposition, "inline");
  assert.equal(mensagens[0].attachments[1].contentType, "application/pdf");
  assert.equal(mensagens[0].attachments[1].content.toString(), "%PDF-exemplo");
  assert.equal(JSON.stringify(mensagens[0]).includes("segredo-falso"), false);
});

test("HTML tem alternativa em texto, logo embutido e escapa conteúdo do banco", () => {
  const html = htmlMensagem({ assunto: "Proposta <nova>",
    conteudo: "Olá, <script>alert('x')</script>.\n\nValor & prazo." });
  assert.match(html, /Proposta &lt;nova&gt;/);
  assert.match(html, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/);
  assert.match(html, /Valor &amp; prazo/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test("credencial ausente ou destinatário recusado não confirmam envio", async () => {
  assert.throws(() => criarEnvioGmail({ usuario: "equipe@gmail.com", senhaApp: "" }));
  const enviar = criarEnvioGmail({ usuario: "equipe@gmail.com", senhaApp: "segredo-falso",
    transporte: { sendMail: async () => ({ messageId: "gerado-localmente",
      accepted: [], rejected: ["cliente@example.test"] }) },
  });
  await assert.rejects(enviar({ destinatario: "cliente@example.test", assunto: "a", conteudo: "b" }));
});
