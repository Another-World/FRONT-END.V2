import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "sistema_postgres",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 5,
  connectionTimeoutMillis: 5000,
});

// Falhas em clientes ociosos são eventos do pool, fora das promises de query.
// Tratar o evento evita encerrar a API durante uma queda/reinício do banco.
pool.on("error", () => {
  console.error(JSON.stringify({
    evento: "conexao_ociosa_postgres_indisponivel",
    nivel: "erro",
    instante: new Date().toISOString(),
  }));
});
