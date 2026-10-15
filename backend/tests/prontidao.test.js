import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createServer } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import { criarApp } from "../src/app.js";

async function api(t, pool) {
  const server = criarApp({ pool, autenticacao: { supabaseUrl: "https://teste.supabase.co" } })
    .listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
async function ler(base, path = "/api/ready") {
  const r = await fetch(base + path);
  return { status: r.status, headers: r.headers, body: await r.json() };
}

test("prontidão retorna 503 quando PostgreSQL está inacessível; health continua 200", async t => {
  const reserva = createServer();
  reserva.listen(0, "127.0.0.1");
  await once(reserva, "listening");
  const port = reserva.address().port;
  await new Promise(resolve => reserva.close(resolve));
  const pool = new pg.Pool({
    host: "127.0.0.1", port, user: "teste", database: "teste",
    connectionTimeoutMillis: 200, ssl: false,
  });
  t.after(() => pool.end());
  const base = await api(t, pool);
  const r = await ler(base);
  assert.equal(r.status, 503);
  assert.deepEqual(r.body, { status: "indisponivel", banco: "indisponivel" });
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("retry-after"), "5");
  assert.equal((await ler(base, "/api/health")).status, 200);
  assert.equal(pool.totalCount, 0);
});

test("driver pg encerra consulta sem resposta dentro do prazo e descarta a conexão", async t => {
  // Protocolo PostgreSQL mínimo: autentica e aceita a consulta, mas não responde.
  // Exercita o timeout e descarte do pg real; não usa o banco de produção.
  const sockets = new Set();
  const postgres = createServer(socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let startup = Buffer.alloc(0);
    let autenticado = false;
    socket.on("data", chunk => {
      if (autenticado) return;
      startup = Buffer.concat([startup, chunk]);
      if (startup.length < 4 || startup.length < startup.readInt32BE(0)) return;
      autenticado = true;
      socket.write(Buffer.from([82, 0, 0, 0, 8, 0, 0, 0, 0, 90, 0, 0, 0, 5, 73]));
    });
  });
  postgres.listen(0, "127.0.0.1");
  await once(postgres, "listening");
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => postgres.close(resolve));
  });
  const pool = new pg.Pool({
    host: "127.0.0.1", port: postgres.address().port, user: "teste", database: "teste",
    connectionTimeoutMillis: 200, ssl: false,
  });
  t.after(() => pool.end());
  const base = await api(t, pool);
  const inicio = performance.now();
  const r = await ler(base);
  assert.equal(r.status, 503);
  assert.ok(performance.now() - inicio < 5000, "A consulta não pode ficar presa sem prazo.");
  assert.equal(pool.totalCount, 0);
  assert.equal((await ler(base, "/api/health")).status, 200);
});

test("prontidão recupera após falha e não expõe mensagem nem senha do driver", async t => {
  let falha = true;
  const base = await api(t, {
    async query() {
      if (falha) throw new Error("password=segredo-teste host=interno banco=privado");
      return { rows: [{ pronto: 1 }] };
    },
  });
  const r = await ler(base);
  assert.equal(r.status, 503);
  assert.deepEqual(r.body, { status: "indisponivel", banco: "indisponivel" });
  falha = false;
  assert.deepEqual((await ler(base)).body, { status: "ok", banco: "ok" });
});

test("consultas simultâneas de prontidão compartilham uma consulta ao banco", async t => {
  let consultas = 0;
  const base = await api(t, {
    async query() {
      consultas++;
      await new Promise(resolve => setTimeout(resolve, 100));
      return { rows: [{ pronto: 1 }] };
    },
  });
  const respostas = await Promise.all(Array.from({ length: 5 }, () => ler(base)));
  assert.equal(consultas, 1);
  assert.ok(respostas.every(r => r.status === 200));
});

test("limite de prontidão evita consultas adicionais ao banco após a quota", async t => {
  let consultas = 0;
  const base = await api(t, { async query() { consultas++; return { rows: [{ pronto: 1 }] }; } });
  for (let i = 0; i < 60; i++) assert.equal((await ler(base)).status, 200);
  const r = await ler(base);
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(consultas, 60);
  assert.equal((await ler(base, "/api/health")).status, 200);
});

test("erro em conexão ociosa não encerra o processo nem registra dados do erro", async () => {
  const db = new URL("../src/db.js", import.meta.url).href;
  const { stdout, stderr } = await promisify(execFile)(process.execPath, ["--input-type=module", "-e",
    `import { pool } from ${JSON.stringify(db)};
    pool.emit("error", new Error("password=segredo-teste"));
    await pool.end();
    console.log("processo ativo");`,
  ]);
  assert.match(stdout, /processo ativo/);
  const log = JSON.parse(stderr.trim());
  assert.equal(log.evento, "conexao_ociosa_postgres_indisponivel");
  assert.ok(!stderr.includes("segredo-teste"));
});
