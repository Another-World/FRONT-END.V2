import "dotenv/config";
import express from "express";
import helmet from "helmet";

const app = express();
const port = Number(process.env.PORT ?? 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um número entre 1 e 65535.");
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "16kb" }));

// Confirma que a API está funcionando. Ainda não testa o banco de dados.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`API disponível em http://127.0.0.1:${port}`);
});
