import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { PGlite } from "@electric-sql/pglite";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { criarApp } from "../src/app.js";
import { criarProcessadorEmails } from "../src/emails.js";

const A = randomUUID();
const B = randomUUID();
const C = randomUUID();
const caminho = "/api/atendimento/solicitacoes";
let db, pool, server, base, privateKey, resolverChaves;
let fila = Promise.resolve();
async function reservar() {
  const anterior = fila;
  let liberar;
  fila = new Promise((resolve) => {
    liberar = resolve;
  });
  await anterior;
  return liberar;
}
async function query(sql, parametros) {
  const r = await db.query(sql, parametros);
  return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 };
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
async function jwt(id = A, overrides = {}) {
  const {
    issuer = "https://teste.supabase.co/auth/v1",
    audience = "authenticated",
    exp = "1h",
    ...claims
  } = overrides;
  return new SignJWT({
    email: "teste@example.test",
    role: "authenticated",
    is_anonymous: false,
    ...claims,
  })
    .setProtectedHeader({ alg: "ES256", kid: "teste" })
    .setSubject(id)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(privateKey);
}
async function request(method, path = caminho, { token, body, chave } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(token !== undefined
        ? { Authorization: token === "" ? "" : `Bearer ${token}` }
        : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(chave ? { "Idempotency-Key": chave } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    headers: r.headers,
    body: r.headers.get("content-type")?.startsWith("application/pdf")
      ? Buffer.from(await r.arrayBuffer())
      : await r.json(),
  };
}
async function pedido(id = B, overrides = {}) {
  const r = await request("POST", "/api/solicitacoes", {
    token: id ? await jwt(id) : undefined,
    chave: randomUUID(),
    body: {
      nome: "Contato de teste",
      email: "contato@example.test",
      telefone: "11999990000",
      servicoSlug: "hardware",
      cep: "05051000",
      mensagem: "Mensagem privada de teste",
      ...overrides,
    },
  });
  assert.equal(r.status, 201);
  return r.body.id;
}
async function alterar(id, status = "em_contato", versao = 0, token) {
  return request("PATCH", `${caminho}/${id}/status`, {
    token: token ?? (await jwt()),
    body: { status, versao, confirmado: true },
  });
}
before(async () => {
  db = await PGlite.create();
  await db.exec("CREATE ROLE admin; CREATE ROLE aw_api;");
  for (const f of ["001_base.sql", "002_solicitacoes.sql"]) {
    await db.exec(
      await readFile(new URL(`../migrations/${f}`, import.meta.url), "utf8"),
    );
  }
  await db.exec(`GRANT USAGE ON SCHEMA aw TO aw_api;
    GRANT INSERT ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, criada_em) ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, slug, ativo) ON aw.servicos TO aw_api;
    GRANT INSERT (solicitacao_id, tipo) ON aw.solicitacoes_eventos TO aw_api;`);
  for (const f of [
    "003_protecao_solicitacoes.sql",
    "004_usuarios.sql",
    "005_solicitacoes_conta.sql",
    "006_atendimento.sql",
    "007_orcamentos.sql",
    "008_emails.sql",
  ]) {
    await db.exec(
      await readFile(new URL(`../migrations/${f}`, import.meta.url), "utf8"),
    );
  }
  const keys = await generateKeyPair("ES256");
  privateKey = keys.privateKey;
  resolverChaves = createLocalJWKSet({
    keys: [
      { ...(await exportJWK(keys.publicKey)), kid: "teste", alg: "ES256" },
    ],
  });
  pool = {
    async query(sql, parametros) {
      const liberar = await reservar();
      try {
        return await query(sql, parametros);
      } finally {
        liberar();
      }
    },
    async connect() {
      const liberar = await reservar();
      return { query, release: liberar };
    },
  };
});
beforeEach(async () => {
  await db.exec(`RESET ROLE;
    TRUNCATE aw.solicitacoes_eventos, aw.solicitacoes_orcamento, aw.usuarios CASCADE;
    GRANT INSERT (solicitacao_id, tipo, detalhes) ON aw.solicitacoes_eventos TO aw_api;
    GRANT INSERT (orcamento_id,tipo,detalhes) ON aw.orcamentos_eventos TO aw_api;`);
  await db.query(
    "INSERT INTO aw.usuarios (id,nome,email,papel) VALUES ($1,'Administrador','admin@example.test','admin'), ($2,'Cliente','cliente@example.test','cliente'), ($3,'Equipe','equipe@example.test','admin')",
    [A, B, C],
  );
  await db.exec("SET ROLE aw_api;");
  server = criarApp({
    pool,
    autenticacao: { supabaseUrl: "https://teste.supabase.co", resolverChaves },
    limiteEnvios: 100,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});
after(async () => {
  await db?.close();
});

const rota = "/api/atendimento/orcamentos";
const dados = {
  descricao: "Instalação de rede",
  escopo: "Projeto, instalação e testes de conexão.",
  valorCentavos: 125050,
  prazo: "10 dias úteis após aprovação",
  condicoes: "Entrada de 50%; saldo na entrega.",
  validade: "2099-12-31",
};
async function criar({
  solicitacaoId,
  chave = randomUUID(),
  body = {},
  token,
} = {}) {
  if (!solicitacaoId) {
    solicitacaoId = await pedido();
    await alterar(solicitacaoId, "aceito");
  }
  return request("POST", rota, {
    token: token ?? (await jwt()),
    chave,
    body: { ...dados, solicitacaoId, ...body },
  });
}
async function acao(o, status, extra = {}) {
  return request("PATCH", `${rota}/${o.id}/status`, {
    token: await jwt(),
    body: { status, versao: o.versao, confirmado: true, ...extra },
  });
}
async function editar(o, extra = {}) {
  return request("PATCH", `${rota}/${o.id}`, {
    token: await jwt(),
    body: { ...dados, versao: o.versao, ...extra },
  });
}
async function ligarEmails() {
  await new Promise(resolve => server.close(resolve));
  server = criarApp({ pool,
    autenticacao: { supabaseUrl: "https://teste.supabase.co", resolverChaves },
    limiteEnvios: 100, emailsEnabled: true,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
}

test("007 restringe grants de identidade, contato, versão, datas, exclusão e auditoria", async () => {
  const r = await pool.query(`SELECT
    has_column_privilege('aw_api','aw.orcamentos','cliente','UPDATE') AS contato,
    has_column_privilege('aw_api','aw.orcamentos','usuario_id','UPDATE') AS dono,
    has_column_privilege('aw_api','aw.orcamentos','solicitacao_id','UPDATE') AS pedido,
    has_column_privilege('aw_api','aw.orcamentos','versao','UPDATE') AS versao,
    has_column_privilege('aw_api','aw.orcamentos','enviada_em','UPDATE') AS data,
    has_column_privilege('aw_api','aw.orcamentos','descricao','UPDATE') AS descricao,
    has_table_privilege('aw_api','aw.orcamentos','DELETE') AS excluir,
    has_table_privilege('aw_api','aw.orcamentos','TRUNCATE') AS limpar,
    has_table_privilege('aw_api','aw.orcamentos_eventos','UPDATE') AS adulterar`);
  assert.deepEqual(r.rows[0], {
    contato: false,
    dono: false,
    pedido: false,
    versao: false,
    data: false,
    descricao: true,
    excluir: false,
    limpar: false,
    adulterar: false,
  });
});
for (const [nome, overrides] of [
  ["expirado", { exp: 1 }],
  ["outro projeto", { issuer: "https://outro.supabase.co/auth/v1" }],
  ["outro publico", { audience: "anon" }],
  ["service_role", { role: "service_role" }],
  ["anonimo", { is_anonymous: true }],
]) {
  test(`orçamentos recusam token ${nome} inclusive no PDF`, async () => {
    const o = (await criar()).body.orcamento,
      token = await jwt(A, overrides);
    for (const [method, path, body] of [
      ["GET", rota],
      ["GET", `${rota}/${o.id}`],
      ["GET", `${rota}/${o.id}/pdf`],
      ["POST", rota, { ...dados, solicitacaoId: o.solicitacaoId }],
      ["PATCH", `${rota}/${o.id}`, { ...dados, versao: 0 }],
      [
        "PATCH",
        `${rota}/${o.id}/status`,
        { status: "enviada", versao: 0, confirmado: true },
      ],
    ])
      assert.equal(
        (await request(method, path, { token, body, chave: randomUUID() }))
          .status,
        401,
      );
  });
}
test("sem sessão, cliente, metadata admin e administrador revogado não leem propostas/PDF", async () => {
  const o = (await criar()).body.orcamento;
  for (const token of [undefined, "", "falso.token.jwt"])
    assert.equal(
      (await request("GET", `${rota}/${o.id}/pdf`, { token })).status,
      401,
    );
  const cliente = await jwt(B, {
    user_metadata: { papel: "admin" },
    app_metadata: { papel: "admin" },
  });
  for (const path of [rota, `${rota}/${o.id}`, `${rota}/${o.id}/pdf`])
    assert.equal((await request("GET", path, { token: cliente })).status, 403);
  const token = await jwt();
  await admin("UPDATE aw.usuarios SET ativo=false WHERE id=$1", [A]);
  assert.equal(
    (await request("GET", `${rota}/${o.id}/pdf`, { token })).status,
    403,
  );
});
test("revalida admin na transação mesmo após passar pelo middleware", async () => {
  const o = (await criar()).body.orcamento,
    original = pool.connect;
  pool.connect = async () => {
    pool.connect = original;
    await admin("UPDATE aw.usuarios SET papel='cliente' WHERE id=$1", [A]);
    return original();
  };
  try {
    assert.equal(
      (await request("GET", `${rota}/${o.id}/pdf`, { token: await jwt() }))
        .status,
      403,
    );
  } finally {
    pool.connect = original;
  }
});
test("criação só para aceitos: dono e contato são copiados do pedido, nunca do formulário", async () => {
  const id = await pedido();
  assert.equal((await criar({ solicitacaoId: id })).status, 409);
  await alterar(id, "aceito");
  for (const body of [
    { usuarioId: A },
    { cliente: { nome: "Forjado" } },
    { status: "enviada" },
    { valorCentavos: 1.5 },
    { validade: "2000-01-01" },
    { valorCentavos: 0 },
    { descricao: " " },
    { escopo: "x".repeat(6001) },
    { prazo: "" },
    { validade: "2026-02-30" },
  ])
    assert.equal((await criar({ solicitacaoId: id, body })).status, 400);
  const r = await criar({ solicitacaoId: id });
  assert.equal(r.status, 200);
  const saved = (
    await admin(
      "SELECT usuario_id,cliente,status,versao FROM aw.orcamentos WHERE id=$1",
      [r.body.orcamento.id],
    )
  ).rows[0];
  assert.equal(saved.usuario_id, B);
  assert.equal(saved.cliente.email, "contato@example.test");
  assert.equal(saved.status, "rascunho");
  assert.equal(saved.versao, 0);
  const visitante = await pedido(null);
  await alterar(visitante, "aceito");
  const anon = await criar({ solicitacaoId: visitante });
  assert.equal(
    (
      await admin("SELECT usuario_id FROM aw.orcamentos WHERE id=$1", [
        anon.body.orcamento.id,
      ])
    ).rows[0].usuario_id,
    null,
  );
});
test("reenvio idempotente e rascunho único não duplicam proposta nem evento", async () => {
  const id = await pedido();
  await alterar(id, "aceito");
  const chave = randomUUID();
  const rs = await Promise.all([
    criar({ solicitacaoId: id, chave }),
    criar({ solicitacaoId: id, chave }),
  ]);
  assert.deepEqual(
    rs.map((r) => r.status),
    [200, 200],
  );
  assert.equal(rs[0].body.orcamento.id, rs[1].body.orcamento.id);
  assert.equal(
    (
      await criar({
        solicitacaoId: id,
        chave,
        body: { descricao: "Outro serviço" },
      })
    ).status,
    409,
  );
  assert.equal((await criar({ solicitacaoId: id })).status, 409);
  assert.equal(
    (await admin("SELECT count(*)::int AS n FROM aw.orcamentos_eventos"))
      .rows[0].n,
    1,
  );
});
test("edição preserva vínculo, incrementa versão e recusa versão antiga", async () => {
  const o = (await criar()).body.orcamento;
  const r = await editar(o, { descricao: "Instalação revisada" });
  assert.equal(r.status, 200);
  assert.equal(r.body.orcamento.versao, 1);
  assert.equal((await editar(o)).status, 409);
  assert.equal(
    (await editar(r.body.orcamento, { descricao: "Instalação revisada" })).body
      .orcamento.versao,
    1,
  );
  assert.equal(
    (await editar(r.body.orcamento, { cliente: { nome: "Outro" } })).status,
    400,
  );
});
test("envio manual exige confirmação, congela comercial e registra resposta com origem/ator", async () => {
  const o = (await criar()).body.orcamento;
  assert.equal((await acao(o, "enviada", { confirmado: false })).status, 400);
  assert.equal(
    (await acao(o, "aceita", { nota: "Contato por e-mail" })).status,
    409,
  );
  const enviada = (await acao(o, "enviada")).body.orcamento;
  assert.equal(enviada.status, "enviada");
  assert.ok(enviada.enviadaEm);
  assert.equal((await editar(enviada)).status, 409);
  await assert.rejects(
    pool.query("UPDATE aw.orcamentos SET descricao=$2 WHERE id=$1", [
      o.id,
      "Ataque direto",
    ]),
    (e) => e.code === "23514",
  );
  assert.equal((await acao(enviada, "aceita")).status, 409);
  const r = await acao(enviada, "aceita", {
    nota: "Cliente respondeu por e-mail em 15/10.",
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.orcamento.versao, 2);
  assert.ok(r.body.orcamento.respondidaEm);
  const d = await request("GET", `${rota}/${o.id}`, { token: await jwt() });
  assert.equal(d.body.historico.length, 3);
  const e = d.body.historico.find((x) => x.tipo === "resposta_registrada");
  assert.equal(e.detalhes.administradorId, A);
  assert.equal(e.detalhes.origem, "registro_manual");
  assert.equal(e.detalhes.confirmado, true);
  assert.equal(
    (await acao(r.body.orcamento, "recusada", { nota: "Outro" })).status,
    409,
  );
});
test("proposta recusada permite outra proposta sem alterar a anterior", async () => {
  const o = (await criar()).body.orcamento;
  const enviada = (await acao(o, "enviada")).body.orcamento;
  await acao(enviada, "recusada", { nota: "Resposta por telefone." });
  const nova = await criar({ solicitacaoId: o.solicitacaoId });
  assert.equal(nova.status, 200);
  assert.notEqual(nova.body.orcamento.id, o.id);
});
test("solicitação cancelada ou validade expirada bloqueiam edição e envio, mas preservam consulta", async () => {
  const o = (await criar()).body.orcamento;
  await alterar(o.solicitacaoId, "cancelada", 1);
  assert.equal((await editar(o)).status, 409);
  assert.equal((await acao(o, "enviada")).status, 409);
  assert.equal(
    (await request("GET", `${rota}/${o.id}`, { token: await jwt() })).status,
    200,
  );
  const outro = (await criar()).body.orcamento;
  await admin("UPDATE aw.orcamentos SET validade='2000-01-01' WHERE id=$1", [
    outro.id,
  ]);
  const atual = (
    await request("GET", `${rota}/${outro.id}`, { token: await jwt() })
  ).body.orcamento;
  assert.equal((await acao(atual, "enviada")).status, 400);
});
test("auditoria indisponível desfaz criação, edição e mudança de status", async () => {
  const o = (await criar()).body.orcamento;
  await admin("REVOKE INSERT ON aw.orcamentos_eventos FROM aw_api");
  assert.equal(
    (await editar(o, { descricao: "Não deve persistir" })).status,
    500,
  );
  assert.equal((await acao(o, "enviada")).status, 500);
  const tentativa = await criar();
  assert.equal(tentativa.status, 500);
  const salvo = (
    await admin(
      "SELECT descricao,versao,status FROM aw.orcamentos WHERE id=$1",
      [o.id],
    )
  ).rows[0];
  assert.deepEqual(salvo, {
    descricao: dados.descricao,
    versao: 0,
    status: "rascunho",
  });
  assert.equal(
    (await admin("SELECT count(*)::int AS n FROM aw.orcamentos")).rows[0].n,
    1,
  );
});
test("duas edições com a mesma versão: uma vence e outra retorna conflito", async () => {
  const o = (await criar()).body.orcamento;
  const rs = await Promise.all([
    editar(o, { descricao: "Uma edição" }),
    editar(o, { descricao: "Outra edição" }),
  ]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
});
test("listagem pagina por microssegundos e UUID, combina filtros e recusa filtros extras", async () => {
  const os = [];
  for (let i = 0; i < 3; i++) os.push((await criar()).body.orcamento);
  // Ajuste de fixture pelo owner; o trigger é reativado antes de chamar a API.
  await admin("ALTER TABLE aw.orcamentos DISABLE TRIGGER orcamento_protegido");
  try {
    for (let i = 0; i < 3; i++)
      await admin("UPDATE aw.orcamentos SET criada_em=$2 WHERE id=$1", [
        os[i].id,
        `2026-10-15T12:00:00.00000${i === 2 ? 2 : 1}Z`,
      ]);
  } finally {
    await admin("ALTER TABLE aw.orcamentos ENABLE TRIGGER orcamento_protegido");
  }
  const ids = [];
  let cursor;
  do {
    const r = await request(
      "GET",
      `${rota}?limite=1${cursor ? "&cursor=" + cursor : ""}`,
      { token: await jwt() },
    );
    assert.equal(r.status, 200);
    ids.push(...r.body.orcamentos.map((o) => o.id));
    cursor = r.body.proximoCursor;
  } while (cursor);
  assert.deepEqual(ids, [os[2].id, ...[os[0].id, os[1].id].sort().reverse()]);
  await acao(os[0], "enviada");
  const r = await request(
    "GET",
    `${rota}?status=enviada&solicitacaoId=${os[0].solicitacaoId}`,
    { token: await jwt() },
  );
  assert.deepEqual(
    r.body.orcamentos.map((o) => o.id),
    [os[0].id],
  );
  for (const q of ["usuarioId=" + B, "limite=0", "cursor=aaa", "status=admin"])
    assert.equal(
      (await request("GET", `${rota}?${q}`, { token: await jwt() })).status,
      400,
    );
});
test("PDF protegido contém dados comerciais, sem URL pública nem ampliação da área do cliente", async () => {
  const o = (await criar()).body.orcamento;
  const r = await request("GET", `${rota}/${o.id}/pdf`, { token: await jwt() });
  assert.equal(r.status, 200);
  assert.equal(r.body.subarray(0, 5).toString(), "%PDF-");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(
    r.headers.get("content-disposition"),
    /inline; filename="proposta-/,
  );
  const cliente = await request("GET", "/api/solicitacoes", {
    token: await jwt(B),
  });
  assert.ok(!JSON.stringify(cliente.body).includes("valorCentavos"));
  assert.ok(!JSON.stringify(cliente.body).includes("contato@example.test"));
});

test("008 não amplia privilégios e mantém e-mails desligados até configuração", async () => {
  const g = (await pool.query(`SELECT
    has_table_privilege('aw_api','aw.comunicacoes','DELETE') AS excluir,
    has_column_privilege('aw_api','aw.comunicacoes','destinatario','UPDATE') AS destino,
    has_column_privilege('aw_api','aw.comunicacoes','provedor_id','UPDATE') AS retorno`)).rows[0];
  assert.deepEqual(g, { excluir: false, destino: false, retorno: true });
  const o = (await criar()).body.orcamento;
  const r = await request("POST", `${rota}/${o.id}/email`, {
    token: await jwt(), body: { versao: 0, confirmado: true },
  });
  assert.equal(r.status, 503);
  assert.equal((await request("GET", `${rota}/${o.id}`, { token: await jwt() })).body.emailDisponivel, false);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM aw.comunicacoes")).rows[0].n, 0);
});

test("decisão ativa enfileira uma vez o destinatário do pedido, sem envio prematuro", async () => {
  await ligarEmails();
  const id = await pedido(null, { email: "destino@example.test" });
  const a = await alterar(id, "aceito");
  assert.equal(a.status, 200);
  assert.equal((await alterar(id, "aceito", a.body.solicitacao.versao)).status, 200);
  const r = await pool.query("SELECT * FROM aw.comunicacoes WHERE solicitacao_id=$1", [id]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].status, "pendente");
  assert.equal(r.rows[0].destinatario, "destino@example.test");
  assert.match(r.rows[0].conteudo, /aceita/);
  const inv = await request("PATCH", `${caminho}/${id}/status`, {
    token: await jwt(B), body: { status: "negado", versao: a.body.solicitacao.versao, confirmado: true },
  });
  assert.equal(inv.status, 403);
});

test("proposta enfileirada congela dados e só muda para enviada depois da aceitação pelo provedor", async () => {
  await ligarEmails();
  const o = (await criar()).body.orcamento;
  const caminhoEmail = `${rota}/${o.id}/email`;
  assert.equal((await request("POST", caminhoEmail, { token: await jwt(B),
    body: { versao: 0, confirmado: true } })).status, 403);
  assert.equal((await request("POST", caminhoEmail, { token: await jwt(),
    body: { versao: 0, confirmado: false } })).status, 400);
  const r = await request("POST", caminhoEmail, { token: await jwt(),
    body: { versao: 0, confirmado: true } });
  assert.equal(r.status, 200);
  assert.equal(r.body.orcamento.status, "aguardando_envio");
  assert.equal(r.body.orcamento.enviadaEm, null);
  assert.equal((await editar(r.body.orcamento)).status, 409);
  assert.equal((await acao(r.body.orcamento, "enviada")).status, 409);
  assert.equal((await criar({ solicitacaoId: o.solicitacaoId })).status, 409);
  const visto = [];
  const filaEmail = criarProcessadorEmails(pool, async msg => {
    visto.push(msg);
    return "ses-teste-123";
  });
  assert.equal(await filaEmail.processarUm(), true);
  assert.equal(await filaEmail.processarUm(), true);
  assert.equal(await filaEmail.processarUm(), false);
  assert.equal(visto.length, 2);
  const propostaEnviada = visto.find(v => v.anexo);
  assert.equal(propostaEnviada.destinatario, "contato@example.test");
  assert.equal(propostaEnviada.anexo.subarray(0, 5).toString(), "%PDF-");
  const detalhe = (await request("GET", `${rota}/${o.id}`, { token: await jwt() })).body;
  assert.equal(detalhe.orcamento.status, "enviada");
  assert.ok(detalhe.orcamento.enviadaEm);
  assert.equal(detalhe.email.status, "enviada");
  assert.equal(detalhe.email.tentativas, 1);
  assert.equal(detalhe.historico[0].tipo, "email_aceito_pelo_provedor");
});

test("falha incerta não é reenviada e mantém a proposta aguardando", async () => {
  await ligarEmails();
  const o = (await criar()).body.orcamento;
  await request("POST", `${rota}/${o.id}/email`, { token: await jwt(),
    body: { versao: 0, confirmado: true } });
  let tentativas = 0;
  const filaEmail = criarProcessadorEmails(pool, async () => {
    tentativas++;
    if (tentativas === 2) throw new Error("timeout do provedor");
    return "ses-teste-decisao";
  });
  assert.equal(await filaEmail.processarUm(), true);
  assert.equal(await filaEmail.processarUm(), true);
  assert.equal(await filaEmail.processarUm(), false);
  assert.equal(tentativas, 2);
  const d = (await request("GET", `${rota}/${o.id}`, { token: await jwt() })).body;
  assert.equal(d.email.status, "falhou");
  assert.equal(d.email.erro, "resultado_incerto");
  assert.equal(d.orcamento.status, "aguardando_envio");
  assert.equal(d.orcamento.enviadaEm, null);
});
