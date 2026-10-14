import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { criarHandlerSolicitacoes } from "./solicitacoes.js";
import { criarAutenticacao, criarAutenticacaoOpcional } from "./autenticacao.js";
import { criarHandlerListagemSolicitacoes } from "./listagemSolicitacoes.js";
import { criarHandlersUsuarios } from "./usuarios.js";
import { criarHandlerProntidao } from "./prontidao.js";

export function criarApp({ pool, autenticacao = {}, limiteEnvios = 10, limiteConsultas = 120 }) {
  const app = express();
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
    limit: limiteEnvios,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { erro: "Muitas tentativas de envio. Aguarde 15 minutos antes de tentar novamente." },
  });

  const exigirAutenticacao = criarAutenticacao(autenticacao);
  const usuarios = criarHandlersUsuarios(pool);
  const limitePerfil = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: limiteConsultas,
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
  app.get("/api/ready", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  }, rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { erro: "Muitas verificações. Aguarde um minuto." },
  }), criarHandlerProntidao(pool));
  app.use("/api/solicitacoes", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/solicitacoes", limitePerfil, exigirAutenticacao, criarHandlerListagemSolicitacoes(pool));
  app.post(
    "/api/solicitacoes",
    limiteSolicitacoes,
    criarAutenticacaoOpcional(exigirAutenticacao),
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

  return app;
}
