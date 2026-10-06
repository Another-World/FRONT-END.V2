import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pool } from "./db.js";
import { criarHandlerSolicitacoes } from "./solicitacoes.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um número entre 1 e 65535.");
}
if (!process.env.PGUSER || !process.env.PGPASSWORD) {
  throw new Error("Defina PGUSER e PGPASSWORD no ambiente.");
}
app.disable("x-powered-by");
app.use(helmet());

// No desenvolvimento, não confiamos em IPs informados por headers do cliente.
// Antes do deploy, configuraremos Nginx e trust proxy juntos, de forma restrita.
app.set("trust proxy", false);
const limiteSolicitacoes = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de envio. Aguarde 15 minutos antes de tentar novamente." },
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.post(
  "/api/solicitacoes",
  limiteSolicitacoes,
  express.json({ limit: "16kb" }),
  criarHandlerSolicitacoes(pool),
);

// Erros de leitura do corpo também devem chegar ao formulário como JSON.
app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
  if (error.type === "entity.too.large") return res.status(413).json({ erro: "Solicitação excede o tamanho permitido." });
  console.error("Erro interno da API:", { codigo: error.code ?? "interno" });
  return res.status(500).json({ erro: "Falha interna da API." });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`API disponível em http://127.0.0.1:${port}`);
});
