import nodemailer from "nodemailer";

const emailValido = (valor) => typeof valor === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);

export function criarEnvioGmail({ usuario, senhaApp, transporte } = {}) {
  if (!emailValido(usuario) || !senhaApp || typeof senhaApp !== "string") {
    throw new Error("Configure SMTP_USER e SMTP_APP_PASSWORD antes de habilitar e-mails.");
  }
  const smtp = transporte ?? nodemailer.createTransport({
    service: "gmail",
    secure: true,
    auth: { user: usuario, pass: senhaApp },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    dnsTimeout: 10000,
  });
  return async ({ destinatario, assunto, conteudo, anexo, nomeArquivo }) => {
    if (!emailValido(destinatario)) throw new Error("Destinatário inválido.");
    const resposta = await smtp.sendMail({
      from: usuario,
      to: destinatario,
      subject: assunto,
      text: conteudo,
      ...(anexo ? { attachments: [{ filename: nomeArquivo,
        content: anexo, contentType: "application/pdf" }] } : {}),
    });
    if (!resposta?.messageId || !resposta.accepted?.some(
      (endereco) => endereco.toLowerCase() === destinatario.toLowerCase()
    ) || resposta.rejected?.length) throw new Error("SMTP não confirmou o destinatário.");
    return resposta.messageId;
  };
}
