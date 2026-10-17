import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { PGlite } from "@electric-sql/pglite";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { criarApp } from "../src/app.js";

let db, server, base, privateKey;
const adminId = randomUUID(), clienteId = randomUUID(), outroId = randomUUID();
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
  const r = await fetch(base + path, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
  return { status: r.status, body: await r.json(), headers: r.headers };
}

before(async () => {
  db = await PGlite.create();
  await db.exec("CREATE ROLE admin; CREATE ROLE aw_api;");
  for (const f of ["001_base.sql", "002_solicitacoes.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
  }
  await db.exec(`GRANT USAGE ON SCHEMA aw TO aw_api;
    GRANT INSERT ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, criada_em) ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, slug, ativo) ON aw.servicos TO aw_api;
    GRANT INSERT (solicitacao_id, tipo) ON aw.solicitacoes_eventos TO aw_api;`);
  for (const f of ["003_protecao_solicitacoes.sql", "004_usuarios.sql", "005_solicitacoes_conta.sql",
    "006_atendimento.sql", "007_orcamentos.sql", "008_emails.sql", "009_consulta_usuarios.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
  }
  await db.query(`INSERT INTO aw.usuarios (id, nome, email, papel, criado_em)
    VALUES ($1,'Administrador','admin@example.test','admin','2026-10-16T10:00:00.000001Z'),
      ($2,'Cliente Um','cliente@example.test','cliente','2026-10-16T10:00:00.000002Z'),
      ($3,'Cliente Dois','outro@example.test','cliente','2026-10-16T10:00:00.000003Z')`, [adminId,clienteId,outroId]);
  const servico = (await db.query("SELECT id FROM aw.servicos LIMIT 1")).rows[0].id;
  await db.query(`INSERT INTO aw.solicitacoes_orcamento
    (usuario_id, servico_id, nome_contato, email_contato, telefone_contato, cep, mensagem)
    VALUES ($1,$3,'Primeiro','primeiro@example.test','11999990000','05051000','Privado 1'),
      ($2,$3,'Outro','outro@example.test','11999990000','05051000','Privado 2')`, [clienteId,outroId,servico]);
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  const jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid:"teste", alg:"ES256" }] });
  await db.exec("SET ROLE aw_api");
  const pool = {
    query: executar,
    async connect() {
      const anterior = fila;
      let liberar;
      fila = new Promise(resolve => { liberar = resolve; });
      await anterior;
      return { query: (sql,params) => db.query(sql,params), release: liberar };
    },
  };
  server = criarApp({ pool, autenticacao: { supabaseUrl:"https://teste.supabase.co", resolverChaves:jwks },
    emailsEnabled:false }).listen(0,"127.0.0.1");
  await once(server,"listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server?.close(resolve)); await db?.close(); });

test("cliente e token inválido não consultam usuários nem pedidos", async () => {
  const caminho = "/api/atendimento/usuarios";
  for (const path of [caminho, `${caminho}/${clienteId}`]) {
    assert.equal((await get(path)).status, 401);
    assert.equal((await get(path, await token(clienteId))).status, 403);
    assert.equal((await get(path, await token(adminId,{ user_metadata:{ papel:"admin" }, role:"service_role" }))).status,401);
  }
});

test("busca e paginação estável mostram somente campos necessários", async () => {
  const jwt = await token(adminId);
  const caminho = "/api/atendimento/usuarios";
  const ids = [];
  let cursor;
  do {
    const r = await get(`${caminho}?limite=1${cursor?`&cursor=${cursor}`:""}`,jwt);
    assert.equal(r.status,200);
    assert.equal(r.headers.get("cache-control"),"no-store");
    assert.equal(r.body.usuarios.length,1);
    assert.equal(r.body.usuarios[0].telefone,undefined);
    ids.push(r.body.usuarios[0].id);
    cursor = r.body.proximoCursor;
  } while (cursor);
  assert.deepEqual(ids,[outroId,clienteId,adminId]);
  const busca = await get(`${caminho}?busca=CLIENTE%20UM&ativo=true`,jwt);
  assert.deepEqual(busca.body.usuarios.map(u=>u.id),[clienteId]);
  assert.equal((await get(`${caminho}?busca=%25_`,jwt)).body.usuarios.length,0);
  for (const query of ["?limite=500", "?papel=admin", "?cursor=quebrado"]) {
    assert.equal((await get(caminho+query,jwt)).status,400);
  }
});

test("detalhe limita pedidos ao UUID escolhido e revogação bloqueia acesso", async () => {
  const jwt = await token(adminId);
  const r = await get(`/api/atendimento/usuarios/${clienteId}`,jwt);
  assert.equal(r.status,200);
  assert.equal(r.body.usuario.nome,"Cliente Um");
  assert.equal(r.body.solicitacoes.length,1);
  assert.ok(!JSON.stringify(r.body).includes("Privado 2"));
  assert.equal((await get(`/api/atendimento/usuarios/${randomUUID()}`,jwt)).status,404);
  await db.exec("RESET ROLE");
  await db.query("UPDATE aw.usuarios SET ativo=false WHERE id=$1",[adminId]);
  await db.exec("SET ROLE aw_api");
  assert.equal((await get(`/api/atendimento/usuarios/${clienteId}`,jwt)).status,403);
});

test("índice de paginação não concede edição de papel, status ou exclusão", async () => {
  const r = await executar(`SELECT has_table_privilege('aw_api','aw.usuarios','DELETE') AS excluir,
    has_column_privilege('aw_api','aw.usuarios','papel','UPDATE') AS papel,
    has_column_privilege('aw_api','aw.usuarios','ativo','UPDATE') AS ativo`);
  assert.deepEqual(r.rows[0], { excluir:false, papel:false, ativo:false });
});
