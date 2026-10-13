import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { PGlite } from "@electric-sql/pglite";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { criarApp } from "../src/app.js";

// PostgreSQL isolado em memória; nunca usa PGHOST/credenciais de produção.
const supabaseUrl = "https://teste.supabase.co";
const A = randomUUID();
const B = randomUUID();
const dados = {
  nome: "Cliente de teste", email: "cliente@example.test", telefone: "11999990000",
  servicoSlug: "hardware", cep: "05051000", mensagem: "Pedido de teste automatizado.",
};
let db;
let pool;
let server;
let base;
let privateKey;
let resolverChaves;
let fila = Promise.resolve();

async function reservar() {
  const anterior = fila;
  let liberar;
  fila = new Promise(resolve => { liberar = resolve; });
  await anterior;
  return liberar;
}
async function query(sql, parametros) {
  const resultado = await db.query(sql, parametros);
  return { rows: resultado.rows, rowCount: resultado.rows.length || resultado.affectedRows || 0 };
}
async function admin(sql, parametros) {
  const liberar = await reservar();
  try {
    await db.exec("RESET ROLE");
    return await db.query(sql, parametros);
  } finally {
    await db.exec("SET ROLE aw_api");
    liberar();
  }
}
async function token(id = A, overrides = {}, signingKey = privateKey) {
  const { issuer = `${supabaseUrl}/auth/v1`, audience = "authenticated", exp = "1h", ...claims } = overrides;
  return new SignJWT({ email: "cliente@example.test", role: "authenticated", is_anonymous: false, ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "teste" }).setSubject(id)
    .setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(exp).sign(signingKey);
}
async function requisitar(method, path, { jwt, body, chave } = {}) {
  const resposta = await fetch(base + path, {
    method,
    headers: {
      ...(jwt !== undefined ? { Authorization: jwt === "" ? "" : `Bearer ${jwt}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(chave ? { "Idempotency-Key": chave } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: resposta.status, headers: resposta.headers, body: await resposta.json() };
}
async function perfil(id = A) {
  const r = await requisitar("POST", "/api/perfil", { jwt: await token(id) });
  assert.equal(r.status, 200);
  return r.body.perfil;
}
async function enviar({ id = A, chave = randomUUID(), body = dados } = {}) {
  return requisitar("POST", "/api/solicitacoes", { jwt: id ? await token(id) : undefined, chave, body });
}

before(async () => {
  db = await PGlite.create();
  await db.exec("CREATE ROLE admin; CREATE ROLE aw_api;");
  for (const arquivo of ["001_base.sql", "002_solicitacoes.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${arquivo}`, import.meta.url), "utf8"));
  }
  // Reproduz os grants anteriores à 005 observados na EC2.
  await db.exec(`
    GRANT USAGE ON SCHEMA aw TO aw_api;
    GRANT INSERT ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, criada_em) ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, slug, ativo) ON aw.servicos TO aw_api;
    GRANT INSERT (solicitacao_id, tipo) ON aw.solicitacoes_eventos TO aw_api;
  `);
  for (const arquivo of ["003_protecao_solicitacoes.sql", "004_usuarios.sql", "005_solicitacoes_conta.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${arquivo}`, import.meta.url), "utf8"));
  }
  const keys = await generateKeyPair("ES256");
  privateKey = keys.privateKey;
  resolverChaves = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: "teste", alg: "ES256" }] });
  pool = {
    async query(sql, parametros) {
      const liberar = await reservar();
      try { return await query(sql, parametros); } finally { liberar(); }
    },
    async connect() {
      const liberar = await reservar();
      let liberado = false;
      return { query, release() { if (!liberado) { liberado = true; liberar(); } } };
    },
  };
});
beforeEach(async () => {
  await db.exec(`RESET ROLE;
    TRUNCATE aw.solicitacoes_eventos, aw.solicitacoes_orcamento, aw.usuarios CASCADE;
    GRANT INSERT (solicitacao_id, tipo) ON aw.solicitacoes_eventos TO aw_api;
    SET ROLE aw_api;`);
  server = criarApp({ pool, autenticacao: { supabaseUrl, resolverChaves } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { await new Promise(resolve => server.close(resolve)); });
after(async () => { await db?.close(); });

test("005 concede só as leituras necessárias, mantém contato e exclusão protegidos", async () => {
  const r = await pool.query(`SELECT
    has_column_privilege('aw_api', 'aw.solicitacoes_orcamento', 'status', 'SELECT') AS status,
    has_column_privilege('aw_api', 'aw.servicos', 'nome', 'SELECT') AS nome,
    has_column_privilege('aw_api', 'aw.solicitacoes_orcamento', 'email_contato', 'SELECT') AS contato,
    has_table_privilege('aw_api', 'aw.solicitacoes_orcamento', 'DELETE') AS excluir,
    has_column_privilege('aw_api', 'aw.usuarios', 'papel', 'UPDATE') AS papel`);
  assert.deepEqual(r.rows[0], { status: true, nome: true, contato: false, excluir: false, papel: false });
});

for (const [nome, overrides] of [
  ["expirado", { exp: Math.floor(Date.now() / 1000) - 60 }],
  ["outro projeto", { issuer: "https://outro.supabase.co/auth/v1" }],
  ["outro público", { audience: "anon" }],
  ["role administrativo", { role: "service_role" }],
  ["usuário anônimo Supabase", { is_anonymous: true }],
]) {
  test(`recusa JWT ${nome} na criação e listagem`, async () => {
    const jwt = await token(A, overrides);
    assert.equal((await requisitar("GET", "/api/solicitacoes", { jwt })).status, 401);
    assert.equal((await requisitar("POST", "/api/solicitacoes", { jwt, body: dados, chave: randomUUID() })).status, 401);
  });
}
test("GET exige token; POST não rebaixa tokens vazios/forjados a visitantes", async () => {
  assert.equal((await requisitar("GET", "/api/solicitacoes")).status, 401);
  for (const jwt of ["", "token.falso.invalido"]) {
    assert.equal((await requisitar("POST", "/api/solicitacoes", { jwt, body: dados, chave: randomUUID() })).status, 401);
  }
  const outraChave = await generateKeyPair("ES256");
  assert.equal((await requisitar("GET", "/api/solicitacoes", { jwt: await token(A, {}, outraChave.privateKey) })).status, 401);
});

test("pedido visitante mantém usuario_id NULL e reenvio idempotente", async () => {
  const chave = randomUUID();
  const primeiro = await enviar({ id: null, chave });
  const repetido = await enviar({ id: null, chave });
  assert.equal(primeiro.status, 201);
  assert.equal(repetido.status, 200);
  assert.equal(primeiro.body.id, repetido.body.id);
  const row = (await admin("SELECT usuario_id FROM aw.solicitacoes_orcamento WHERE id = $1", [primeiro.body.id])).rows[0];
  assert.equal(row.usuario_id, null);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_eventos")).rows[0].n, 1);
});

test("pedido autenticado cria perfil e usa UUID do JWT mesmo com outro e-mail de contato", async () => {
  const r = await enviar({ body: { ...dados, email: "outro@example.test" } });
  assert.equal(r.status, 201);
  const pedido = (await admin("SELECT usuario_id FROM aw.solicitacoes_orcamento WHERE id=$1", [r.body.id])).rows[0];
  assert.equal(pedido.usuario_id, A);
  const lista = await requisitar("GET", "/api/solicitacoes", { jwt: await token(A) });
  assert.equal(lista.status, 200);
  assert.equal(lista.headers.get("cache-control"), "no-store");
  assert.deepEqual(lista.body.solicitacoes.map(x => x.id), [r.body.id]);
  assert.deepEqual(Object.keys(lista.body.solicitacoes[0]).sort(), ["atualizadaEm", "criadaEm", "id", "servico", "status"]);
  await perfil(B);
  const outraLista = await requisitar("GET", "/api/solicitacoes", { jwt: await token(B) });
  assert.deepEqual(outraLista.body.solicitacoes, []);
});

test("reenvio da mesma conta retorna protocolo; outra conta/visitante não o recupera", async () => {
  const chave = randomUUID();
  const primeiro = await enviar({ chave });
  const repetido = await enviar({ chave });
  assert.equal(repetido.status, 200);
  assert.equal(repetido.body.id, primeiro.body.id);
  for (const id of [B, null]) {
    const r = await enviar({ id, chave });
    assert.equal(r.status, 409);
    assert.equal(r.body.id, undefined);
  }
  assert.equal((await enviar({ chave, body: { ...dados, mensagem: "Mudou" } })).status, 409);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_orcamento")).rows[0].n, 1);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_eventos")).rows[0].n, 1);
});

test("login posterior não reivindica pedido anônimo por e-mail ou chave", async () => {
  const chave = randomUUID();
  assert.equal((await enviar({ id: null, chave })).status, 201);
  assert.equal((await enviar({ chave })).status, 409);
  await perfil();
  const lista = await requisitar("GET", "/api/solicitacoes", { jwt: await token() });
  assert.deepEqual(lista.body.solicitacoes, []);
});

test("recusa userId/papel/ativo no corpo e filtros de dono na listagem", async () => {
  for (const campo of ["usuario_id", "userId", "papel", "ativo"]) {
    assert.equal((await enviar({ body: { ...dados, [campo]: B } })).status, 400);
  }
  for (const query of [`usuario_id=${B}`, "email=cliente%40example.test", "limite=0", "limite=51", "cursor=invalido"]) {
    assert.equal((await requisitar("GET", `/api/solicitacoes?${query}`, { jwt: await token() })).status, 400);
  }
});

test("conta desativada não cria nem lista solicitações ou altera perfil", async () => {
  await perfil();
  await admin("UPDATE aw.usuarios SET ativo=false WHERE id=$1", [A]);
  assert.equal((await enviar()).status, 403);
  assert.equal((await requisitar("GET", "/api/solicitacoes", { jwt: await token() })).status, 403);
  assert.equal((await requisitar("PATCH", "/api/perfil", { jwt: await token(), body: { nome: "Teste", telefone: null, empresa: null } })).status, 403);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_orcamento")).rows[0].n, 0);
});

test("metadata não concede papel admin; sincronização preserva edições do perfil", async () => {
  const jwt = await token(A, { user_metadata: { name: "Sugestão", papel: "admin" } });
  const p = await requisitar("POST", "/api/perfil", { jwt });
  assert.equal(p.body.perfil.papel, "cliente");
  const r = await requisitar("PATCH", "/api/perfil", { jwt, body: { nome: "Nome editado", telefone: "11999998888", empresa: "Empresa editada" } });
  assert.equal(r.status, 200);
  assert.equal((await enviar()).status, 201);
  const atual = await requisitar("GET", "/api/perfil", { jwt });
  assert.equal(atual.body.perfil.nome, "Nome editado");
  assert.equal(atual.body.perfil.empresa, "Empresa editada");
  assert.equal(atual.body.perfil.telefone, "11999998888");
  const externo = await requisitar("GET", `/api/perfil?usuario_id=${A}`, { jwt: await token(B) });
  assert.equal(externo.status, 404);
});

test("paginação preserva microssegundos e desempate e exclui outra conta/visitantes", async () => {
  await perfil(A);
  await perfil(B);
  const datas = ["2026-10-13T18:00:00.123789Z", "2026-10-13T18:00:00.123456Z", "2026-10-13T18:00:00.123456Z", "2026-10-13T18:00:00.123001Z", "2026-10-12T18:00:00.000000Z"];
  for (const criadaEm of datas) {
    await admin(`INSERT INTO aw.solicitacoes_orcamento
      (usuario_id, nome_contato, email_contato, telefone_contato, cep, mensagem, criada_em)
      VALUES ($1, 'Teste', 'cliente@example.test', '11999990000', '05051000', 'Teste', $2)`, [A, criadaEm]);
  }
  for (const id of [B, null]) {
    await admin(`INSERT INTO aw.solicitacoes_orcamento
      (usuario_id, nome_contato, email_contato, telefone_contato, cep, mensagem, criada_em)
      VALUES ($1, 'Teste', 'cliente@example.test', '11999990000', '05051000', 'Teste', $2)`, [id, datas[0]]);
  }
  const esperados = (await admin("SELECT id FROM aw.solicitacoes_orcamento WHERE usuario_id=$1 ORDER BY criada_em DESC, id DESC", [A])).rows.map(x => x.id);
  const encontrados = [];
  let cursor;
  do {
    const url = "/api/solicitacoes?limite=2" + (cursor ? `&cursor=${cursor}` : "");
    const r = await requisitar("GET", url, { jwt: await token() });
    assert.equal(r.status, 200);
    encontrados.push(...r.body.solicitacoes.map(x => x.id));
    cursor = r.body.proximoCursor;
  } while (cursor);
  assert.deepEqual(encontrados, esperados);
  assert.equal(new Set(encontrados).size, 5);
});

test("cursor com UUID de outra conta só delimita pedidos da própria conta", async () => {
  const a = await enviar();
  const b = await enviar({ id: B });
  const cursor = Buffer.from(JSON.stringify({ id: b.body.id, criadaEm: "2099-01-01T00:00:00.000000Z" })).toString("base64url");
  const r = await requisitar("GET", `/api/solicitacoes?cursor=${cursor}`, { jwt: await token(A) });
  assert.deepEqual(r.body.solicitacoes.map(x => x.id), [a.body.id]);
});

test("falha ao gravar evento desfaz pedido e perfil inicial", async () => {
  await admin("REVOKE INSERT ON aw.solicitacoes_eventos FROM aw_api");
  // A permissão anterior é por coluna e precisa ser revogada nesse nível.
  await admin("REVOKE INSERT (solicitacao_id, tipo) ON aw.solicitacoes_eventos FROM aw_api");
  assert.equal((await enviar()).status, 500);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_orcamento")).rows[0].n, 0);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.usuarios")).rows[0].n, 0);
});

test("dois reenvios simultâneos confirmam um único pedido/evento", async () => {
  const chave = randomUUID();
  const resultados = await Promise.all([enviar({ chave }), enviar({ chave })]);
  assert.deepEqual(resultados.map(x => x.status).sort(), [200, 201]);
  assert.equal(resultados[0].body.id, resultados[1].body.id);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_eventos")).rows[0].n, 1);
});
