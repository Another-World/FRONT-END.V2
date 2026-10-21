import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { PGlite } from "@electric-sql/pglite";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { criarApp } from "../src/app.js";

let db, server, base, privateKey;
const adminId = randomUUID(), clienteId = randomUUID();
let fila = Promise.resolve();

async function executar(sql, parametros) {
  const anterior = fila;
  let liberar;
  fila = new Promise(resolve => { liberar = resolve; });
  await anterior;
  try { return await db.query(sql, parametros); }
  finally { liberar(); }
}

async function token(id, extras = {}) {
  return new SignJWT({ email: "teste@example.test", role: "authenticated", is_anonymous: false, ...extras })
    .setProtectedHeader({ alg: "ES256", kid: "teste" }).setSubject(id)
    .setIssuer("https://teste.supabase.co/auth/v1").setAudience("authenticated")
    .setIssuedAt().setExpirationTime("1h").sign(privateKey);
}

async function get(path, jwt) {
  const resposta = await fetch(base + path, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
  return { status: resposta.status, body: await resposta.json(), headers: resposta.headers };
}

before(async () => {
  db = await PGlite.create();
  await db.exec("CREATE ROLE admin; CREATE ROLE aw_api;");
  for (const arquivo of ["001_base.sql", "002_solicitacoes.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${arquivo}`, import.meta.url), "utf8"));
  }
  await db.exec(`GRANT USAGE ON SCHEMA aw TO aw_api;
    GRANT INSERT ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, criada_em) ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, slug, ativo) ON aw.servicos TO aw_api;
    GRANT INSERT (solicitacao_id, tipo) ON aw.solicitacoes_eventos TO aw_api;`);
  for (const arquivo of ["003_protecao_solicitacoes.sql", "004_usuarios.sql", "005_solicitacoes_conta.sql",
    "006_atendimento.sql", "007_orcamentos.sql", "008_emails.sql", "009_consulta_usuarios.sql",
    "010_avaliacoes.sql", "011_codigos_solicitacoes.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${arquivo}`, import.meta.url), "utf8"));
  }
  const servico = (await db.query("SELECT id FROM aw.servicos LIMIT 1")).rows[0].id;
  await db.query(`INSERT INTO aw.usuarios (id,nome,email,papel,criado_em)
    VALUES ($1,'Yukio','admin@example.test','admin','2026-10-17T10:00:00.000001Z'),
      ($2,'Cliente','cliente@example.test','cliente','2026-10-17T10:00:00.000002Z')`, [adminId, clienteId]);
  const status = ["em_analise", "aceito", "negado", "em_contato", "em_analise"];
  for (const [indice, situacao] of status.entries()) {
    await db.query(`INSERT INTO aw.solicitacoes_orcamento
      (usuario_id,servico_id,nome_contato,email_contato,telefone_contato,cep,mensagem,status,criada_em)
      VALUES ($1,$2,$3,$4,'11999990000','05051000','Privado',$5,$6)`, [
      clienteId, servico, `Cliente ${indice + 1}`, `cliente${indice + 1}@example.test`, situacao,
      `2026-10-17T10:0${indice}:00.00000${indice + 1}Z`,
    ]);
  }
  const pedidos = (await db.query("SELECT id FROM aw.solicitacoes_orcamento ORDER BY criada_em")).rows;
  for (const situacao of ["rascunho", "aguardando_envio", "enviada", "aceita", "recusada"]) {
    const pedido = pedidos.shift();
    await db.query(`INSERT INTO aw.orcamentos
      (id,solicitacao_id,usuario_id,cliente,descricao,escopo,valor_centavos,prazo,status)
      VALUES ($1,$2,$3,'{}'::jsonb,'Proposta','Escopo',1000,'10 dias',$4)`,
    [randomUUID(), pedido.id, clienteId, situacao]);
  }
  const par = await generateKeyPair("ES256");
  privateKey = par.privateKey;
  const jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(par.publicKey), kid: "teste", alg: "ES256" }] });
  await db.exec("SET ROLE aw_api");
  const pool = {
    query: executar,
    async connect() {
      const anterior = fila;
      let liberar;
      fila = new Promise(resolve => { liberar = resolve; });
      await anterior;
      return { query: (sql, parametros) => db.query(sql, parametros), release: liberar };
    },
  };
  server = criarApp({ pool, autenticacao: { supabaseUrl: "https://teste.supabase.co", resolverChaves: jwks }, emailsEnabled: false }).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => { await new Promise(resolve => server?.close(resolve)); await db?.close(); });

test("dashboard exige administrador e não aceita filtros", async () => {
  const caminho = "/api/atendimento/dashboard";
  assert.equal((await get(caminho)).status, 401);
  assert.equal((await get(caminho, await token(clienteId))).status, 403);
  assert.equal((await get(caminho, await token(adminId, { role: "service_role" }))).status, 401);
  assert.equal((await get(`${caminho}?status=em_analise`, await token(adminId))).status, 400);
});

test("dashboard mostra indicadores reais e somente resumo dos pedidos recentes", async () => {
  const resposta = await get("/api/atendimento/dashboard", await token(adminId));
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get("cache-control"), "no-store");
  assert.deepEqual(resposta.body.indicadores, {
    totalSolicitacoes: 5, emAnalise: 2, aceitasParaOrcamento: 1,
    recusadas: 1, orcamentosEmAndamento: 3,
  });
  assert.equal(resposta.body.solicitacoesRecentes.length, 5);
  assert.equal(resposta.body.solicitacoesRecentes[0].nomeContato, "Cliente 5");
  assert.ok(resposta.body.solicitacoesRecentes.every(item =>
    typeof item.id === "string" && typeof item.status === "string" && typeof item.servico === "string"));
  assert.ok(!JSON.stringify(resposta.body).includes("cliente1@example.test"));
  assert.ok(!JSON.stringify(resposta.body).includes("Privado"));
});

test("dashboard revalida administrador revogado", async () => {
  const jwt = await token(adminId);
  await db.exec("RESET ROLE");
  await db.query("UPDATE aw.usuarios SET ativo=false WHERE id=$1", [adminId]);
  await db.exec("SET ROLE aw_api");
  assert.equal((await get("/api/atendimento/dashboard", jwt)).status, 403);
});
