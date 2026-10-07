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