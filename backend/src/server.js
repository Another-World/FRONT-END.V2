import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pool } from "./db.js";
import { criarHandlerSolicitacoes } from "./solicitacoes.js";
import { criarAutenticacao } from "./autenticacao.js";
import { criarHandlersUsuarios } from "./usuarios.js";

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

// Na EC2, o Nginx encaminhará as requisições pela interface local.
// Em produção, confiamos apenas nesse proxy local para identificar o IP.
// No desenvolvimento, continuamos usando diretamente o IP da conexão.
app.set(
  "trust proxy",
  process.env.NODE_ENV === "production" ? "loopback" : false,
);
const limiteSolicitacoes = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de envio. Aguarde 15 minutos antes de tentar novamente." },
});

const exigirAutenticacao = criarAutenticacao();
const usuarios = criarHandlersUsuarios(pool);
const limitePerfil = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas consultas à conta. Aguarde alguns minutos e tente novamente." },
});

// Autenticar antes de consultar ou alterar qualquer perfil.
// POST sincroniza/cria o perfil; GET lê; PATCH edita os dados permitidos.
app.use("/api/perfil", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
}, limitePerfil, exigirAutenticacao);
app.post("/api/perfil", usuarios.sincronizar);
app.get("/api/perfil", usuarios.consultar);
app.patch("/api/perfil", express.json({ limit: "4kb" }), usuarios.atualizar);

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
