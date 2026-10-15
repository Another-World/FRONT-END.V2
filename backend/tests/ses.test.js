import assert from "node:assert/strict";
import { test } from "node:test";
import { criarEnvioSes } from "../src/ses.js";

test("SES recebe remetente, cliente, texto e PDF, sem buscar credenciais do navegador", async () => {
  const vistos = [];
  const enviar = criarEnvioSes({ regiao: "sa-east-1", remetente: "equipe@example.test",
    cliente: { send: async (comando) => {
      vistos.push(comando.input);
      return { MessageId: "abc-123" };
    } },
  });
  assert.equal(await enviar({ destinatario: "cliente@example.test",
    assunto: "Sua proposta", conteudo: "Olá, cliente.",
    anexo: Buffer.from("%PDF-exemplo"), nomeArquivo: "proposta.pdf" }), "abc-123");
  assert.equal(vistos[0].FromEmailAddress, "equipe@example.test");
  assert.deepEqual(vistos[0].Destination.ToAddresses, ["cliente@example.test"]);
  assert.equal(vistos[0].Content.Simple.Body.Text.Data, "Olá, cliente.");
  assert.equal(vistos[0].Content.Simple.Attachments[0].ContentType, "application/pdf");
  assert.equal(vistos[0].Content.Simple.Attachments[0].RawContent.toString(), "%PDF-exemplo");
});

test("a falta de identidade ou resposta do SES não confirma um envio", async () => {
  assert.throws(() => criarEnvioSes({ regiao: "sa-east-1", remetente: "" }));
  const enviar = criarEnvioSes({ regiao: "sa-east-1", remetente: "equipe@example.test",
    cliente: { send: async () => ({}) },
  });
  await assert.rejects(enviar({ destinatario: "cliente@example.test", assunto: "a", conteudo: "b" }));
});
