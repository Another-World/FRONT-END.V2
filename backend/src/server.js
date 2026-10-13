import "dotenv/config";
import { pool } from "./db.js";
import { criarApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um número entre 1 e 65535.");
}
if (!process.env.PGUSER || !process.env.PGPASSWORD) {
  throw new Error("Defina PGUSER e PGPASSWORD no ambiente.");
}

const app = criarApp({ pool });
app.listen(port, "127.0.0.1", () => {
  console.log(`API disponível em http://127.0.0.1:${port}`);
});
