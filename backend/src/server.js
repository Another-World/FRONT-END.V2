import "dotenv/config";
import { pool } from "./db.js";
import { criarApp } from "./app.js";
import { criarProcessadorEmails } from "./emails.js";
import { criarEnvioGmail } from "./gmail.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um número entre 1 e 65535.");
}
if (!process.env.PGUSER || !process.env.PGPASSWORD) {
  throw new Error("Defina PGUSER e PGPASSWORD no ambiente.");
}

const emailAtivo = process.env.EMAILS_ENABLED === "true";
const enviar = emailAtivo ? criarEnvioGmail({
  usuario: process.env.SMTP_USER, senhaApp: process.env.SMTP_APP_PASSWORD,
}) : null;
const app = criarApp({ pool, emailsEnabled: emailAtivo });
app.listen(port, "127.0.0.1", () => {
  console.log(`API disponível em http://127.0.0.1:${port}`);
});

// Desativado por padrão; credencial SMTP somente no ambiente da EC2.
// Uma mensagem em processamento após reinício exige reconciliação manual.
if (emailAtivo) {
  const fila = criarProcessadorEmails(pool, enviar);
  let ocupado = false;
  const rodada = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      for (let n = 0; n < 10 && await fila.processarUm(); n++);
    } catch (error) {
      console.error(JSON.stringify({ evento: "fila_email_indisponivel", codigo: error.code ?? "interno" }));
    } finally { ocupado = false; }
  };
  setInterval(rodada, 30_000);
  setTimeout(rodada, 1000);
}
