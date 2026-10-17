import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";

const logo = readFileSync(new URL("../assets/another-world-logo.png", import.meta.url));
const logoCid = "logo@another-world.local";

const escaparHtml = valor => String(valor).replace(/[&<>"']/g, caractere => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[caractere]);

export function htmlMensagem({ assunto, conteudo }) {
  const titulo = escaparHtml(assunto);
  const paragrafos = conteudo.trim().split(/\n\s*\n/).map(paragrafo =>
    `<p style="margin:0 0 18px;line-height:1.6">${escaparHtml(paragrafo).replace(/\n/g, "<br>")}</p>`
  ).join("");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#f6f2f8;color:#30263b;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f2f8"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #eadff0;border-radius:12px">
<tr><td style="padding:16px 28px;background:#251331;color:#fff;border-radius:12px 12px 0 0"><img src="cid:${logoCid}" alt="" width="54" height="54" style="display:inline-block;vertical-align:middle;border:0"><span style="vertical-align:middle;font-size:18px;font-weight:bold;letter-spacing:1px">ANOTHER WORLD</span></td></tr>
<tr><td style="padding:32px 28px 14px"><h1 style="margin:0 0 24px;font-size:21px;line-height:1.3;color:#38214b">${titulo}</h1><div style="font-size:15px;line-height:1.6">${paragrafos}</div></td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #eadff0;color:#655a6d;font-size:12px;line-height:1.5">Mensagem enviada pela Another World. Se precisar falar com a equipe, responda a este e-mail.</td></tr>
</table></td></tr></table></body></html>`;
}

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
      from: { name: "Another World", address: usuario },
      to: destinatario,
      subject: assunto,
      text: conteudo,
      html: htmlMensagem({ assunto, conteudo }),
      attachments: [
        { filename: "another-world-logo.png", content: logo,
          contentType: "image/png", contentDisposition: "inline", cid: logoCid },
        ...(anexo ? [{ filename: nomeArquivo, content: anexo,
          contentType: "application/pdf" }] : []),
      ],
    });
    if (!resposta?.messageId || !resposta.accepted?.some(
      (endereco) => endereco.toLowerCase() === destinatario.toLowerCase()
    ) || resposta.rejected?.length) throw new Error("SMTP não confirmou o destinatário.");
    return resposta.messageId;
  };
}
