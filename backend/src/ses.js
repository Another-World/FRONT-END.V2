import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

export function criarEnvioSes({ regiao, remetente, cliente } = {}) {
  if (!regiao || !remetente || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(remetente))
    throw new Error("Configure AWS_REGION e EMAIL_FROM com identidade verificada no SES.");
  const ses = cliente ?? new SESv2Client({ region: regiao, maxAttempts: 1 });
  return async ({ destinatario, assunto, conteudo, anexo, nomeArquivo }) => {
    const r = await ses.send(new SendEmailCommand({
      FromEmailAddress: remetente,
      Destination: { ToAddresses: [destinatario] },
      Content: { Simple: {
        Subject: { Data: assunto, Charset: "UTF-8" },
        Body: { Text: { Data: conteudo, Charset: "UTF-8" } },
        ...(anexo ? { Attachments: [{
          FileName: nomeArquivo, ContentType: "application/pdf",
          RawContent: anexo, ContentDisposition: "ATTACHMENT",
          ContentTransferEncoding: "BASE64",
        }] } : {}),
      } },
    }), { abortSignal: AbortSignal.timeout(15000) });
    if (!r.MessageId) throw new Error("SES não retornou identificador.");
    return r.MessageId;
  };
}
