import assert from "node:assert/strict";
import { test } from "node:test";
import { criarEnvioGmail } from "../src/gmail.js";

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
  assert.equal(mensagens[0].from, "equipe@gmail.com");
  assert.equal(mensagens[0].to, "cliente@example.test");
  assert.equal(mensagens[0].text, "Olá, cliente.");
  assert.equal(mensagens[0].attachments[0].contentType, "application/pdf");
  assert.equal(mensagens[0].attachments[0].content.toString(), "%PDF-exemplo");
  assert.equal(JSON.stringify(mensagens[0]).includes("segredo-falso"), false);
});

test("credencial ausente ou destinatário recusado não confirmam envio", async () => {
  assert.throws(() => criarEnvioGmail({ usuario: "equipe@gmail.com", senhaApp: "" }));
  const enviar = criarEnvioGmail({ usuario: "equipe@gmail.com", senhaApp: "segredo-falso",
    transporte: { sendMail: async () => ({ messageId: "gerado-localmente",
      accepted: [], rejected: ["cliente@example.test"] }) },
  });
  await assert.rejects(enviar({ destinatario: "cliente@example.test", assunto: "a", conteudo: "b" }));
});
