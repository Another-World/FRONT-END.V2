import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { criarApp } from "../src/app.js";

const ADMIN = randomUUID();
const CLIENTE = randomUUID();
const OUTRO = randomUUID();
let db, pool, server, base, privateKey, resolverChaves;
let fila = Promise.resolve();

async function reservar() {
  const anterior = fila;
  let liberar;
  fila = new Promise((resolve) => { liberar = resolve; });
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
async function jwt(id = ADMIN, overrides = {}) {
  const {
    issuer = "https://teste.supabase.co/auth/v1",
    audience = "authenticated",
    exp = "1h",
    ...claims
  } = overrides;
  const emails = {
    [ADMIN]: "admin@example.test",
    [CLIENTE]: "cliente@example.test",
    [OUTRO]: "outro@example.test",
  };
  return new SignJWT({
    email: emails[id] ?? "teste@example.test",
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
async function request(method, path, { token, body } = {}) {
  const resposta = await fetch(base + path, {
    method,
    headers: {
      ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method === "POST" && path === "/api/solicitacoes"
        ? { "Idempotency-Key": randomUUID() } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: resposta.status, body: await resposta.json() };
}
async function pedido(usuario = CLIENTE) {
  const resposta = await request("POST", "/api/solicitacoes", {
    token: await jwt(usuario),
    body: {
      nome: "Cliente de teste",
      email: "cliente@example.test",
      telefone: "11999990000",
      servicoSlug: "hardware",
      cep: "05051000",
      mensagem: "Pedido usado para validar uma avaliação.",
    },
  });
  assert.equal(resposta.status, 201);
  return resposta.body.id;
}
async function concluir(id) {
  await admin("UPDATE aw.solicitacoes_orcamento SET status='aceito' WHERE id=$1", [id]);
  await admin("UPDATE aw.solicitacoes_orcamento SET status='concluida' WHERE id=$1", [id]);
}
async function avaliar(solicitacaoId, usuario = CLIENTE, dados = {}) {
  return request("POST", "/api/avaliacoes", {
    token: await jwt(usuario),
    body: {
      solicitacaoId,
      nota: 5,
      observacoes: "Atendimento cuidadoso e solução confirmada.",
      sugestoes: "Manter as atualizações durante o serviço.",
      ...dados,
    },
  });
}

before(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE ROLE admin; CREATE ROLE aw_api;
    CREATE TABLE public.tb_avaliacoes(id integer PRIMARY KEY);`);
  for (const arquivo of ["001_base.sql", "002_solicitacoes.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${arquivo}`, import.meta.url), "utf8"));
  }
  await db.exec(`GRANT USAGE ON SCHEMA aw TO aw_api;
    GRANT INSERT ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, criada_em) ON aw.solicitacoes_orcamento TO aw_api;
    GRANT SELECT (id, slug, ativo) ON aw.servicos TO aw_api;
    GRANT INSERT (solicitacao_id, tipo) ON aw.solicitacoes_eventos TO aw_api;`);
  for (const arquivo of [
    "003_protecao_solicitacoes.sql",
    "004_usuarios.sql",
    "005_solicitacoes_conta.sql",
    "006_atendimento.sql",
    "007_orcamentos.sql",
    "008_emails.sql",
    "009_consulta_usuarios.sql",
    "010_avaliacoes.sql",
  ]) {
    await db.exec(await readFile(new URL(`../migrations/${arquivo}`, import.meta.url), "utf8"));
  }
  const chaves = await generateKeyPair("ES256");
  privateKey = chaves.privateKey;
  resolverChaves = createLocalJWKSet({
    keys: [{ ...(await exportJWK(chaves.publicKey)), kid: "teste", alg: "ES256" }],
  });
  pool = {
    async query(sql, parametros) {
      const liberar = await reservar();
      try { return await query(sql, parametros); } finally { liberar(); }
    },
    async connect() {
      const liberar = await reservar();
      return { query, release: liberar };
    },
  };
});

beforeEach(async () => {
  await db.exec(`RESET ROLE;
    TRUNCATE aw.avaliacoes_eventos,aw.avaliacoes,aw.orcamentos_eventos,
      aw.orcamentos,aw.solicitacoes_eventos,aw.solicitacoes_orcamento,
      aw.usuarios CASCADE;
    GRANT INSERT (avaliacao_id,administrador_id,status_anterior,status_novo,motivo)
      ON aw.avaliacoes_eventos TO aw_api;`);
  await db.query(`
    INSERT INTO aw.usuarios(id,nome,email,papel) VALUES
      ($1,'Administrador','admin@example.test','admin'),
      ($2,'Cliente','cliente@example.test','cliente'),
      ($3,'Outro cliente','outro@example.test','cliente')`,
  [ADMIN, CLIENTE, OUTRO]);
  await db.exec("SET ROLE aw_api");
  server = criarApp({
    pool,
    autenticacao: { supabaseUrl: "https://teste.supabase.co", resolverChaves },
    limiteEnvios: 100,
    limiteConsultas: 500,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});
after(async () => db?.close());

test("010 preserva tabela legada e concede somente operações necessárias", async () => {
  const resultado = await admin(`SELECT
    to_regclass('public.tb_avaliacoes') IS NOT NULL AS legada,
    has_table_privilege('aw_api','aw.avaliacoes','DELETE') AS pode_excluir,
    has_column_privilege('aw_api','aw.avaliacoes','status','UPDATE') AS muda_status,
    has_column_privilege('aw_api','aw.avaliacoes','nota','UPDATE') AS muda_nota,
    has_column_privilege('aw_api','aw.avaliacoes','usuario_id','INSERT') AS insere_dono,
    has_table_privilege('aw_api','aw.avaliacoes_eventos','DELETE') AS exclui_evento`);
  assert.deepEqual(resultado.rows[0], {
    legada: true,
    pode_excluir: false,
    muda_status: true,
    muda_nota: false,
    insere_dono: true,
    exclui_evento: false,
  });
});

test("cliente só avalia a própria solicitação concluída e autoria vem do JWT", async () => {
  const id = await pedido();
  const cedo = await avaliar(id);
  assert.equal(cedo.status, 409);
  await concluir(id);

  const vazia = await request("GET", `/api/avaliacoes/solicitacoes/${id}`, {
    token: await jwt(CLIENTE),
  });
  assert.equal(vazia.status, 200);
  assert.equal(vazia.body.avaliacao, null);

  const consultaOutro = await request("GET", `/api/avaliacoes/solicitacoes/${id}`, {
    token: await jwt(OUTRO),
  });
  assert.equal(consultaOutro.status, 404);

  const consultaAdmin = await request("GET", `/api/avaliacoes/solicitacoes/${id}`, {
    token: await jwt(ADMIN),
  });
  assert.equal(consultaAdmin.status, 403);

  const outro = await avaliar(id, OUTRO);
  assert.equal(outro.status, 404);

  const administrador = await avaliar(id, ADMIN);
  assert.equal(administrador.status, 403);

  const extra = await avaliar(id, CLIENTE, { usuarioId: OUTRO });
  assert.equal(extra.status, 400);

  const criada = await avaliar(id);
  assert.equal(criada.status, 201);
  assert.equal(criada.body.avaliacao.nota, 5);
  assert.equal(criada.body.avaliacao.status, "pendente");
  const propria = await request("GET", `/api/avaliacoes/solicitacoes/${id}`, {
    token: await jwt(CLIENTE),
  });
  assert.equal(propria.status, 200);
  assert.equal(propria.body.avaliacao.id, criada.body.avaliacao.id);
  assert.equal(propria.body.avaliacao.observacoes,
    "Atendimento cuidadoso e solução confirmada.");
  const persistida = await admin("SELECT usuario_id,solicitacao_id FROM aw.avaliacoes");
  assert.equal(persistida.rows[0].usuario_id, CLIENTE);
  assert.equal(persistida.rows[0].solicitacao_id, id);
});

test("nota e textos são validados e uma solicitação recebe uma única avaliação", async () => {
  const id = await pedido();
  await concluir(id);
  assert.equal((await avaliar(id, CLIENTE, { nota: 0 })).status, 400);
  assert.equal((await avaliar(id, CLIENTE, { nota: 6 })).status, 400);
  assert.equal((await avaliar(id, CLIENTE, { observacoes: "x".repeat(2001) })).status, 400);

  const primeira = await avaliar(id);
  const repetida = await avaliar(id);
  assert.equal(primeira.status, 201);
  assert.equal(repetida.status, 200);
  assert.equal(repetida.body.avaliacao.id, primeira.body.avaliacao.id);
  const diferente = await avaliar(id, CLIENTE, { nota: 4 });
  assert.equal(diferente.status, 409);
  assert.equal((await admin("SELECT count(*)::integer AS total FROM aw.avaliacoes")).rows[0].total, 1);
});

test("listagem administrativa filtra dados reais e calcula indicadores globais", async () => {
  const primeiro = await pedido();
  const segundo = await pedido();
  await concluir(primeiro);
  await concluir(segundo);
  const a = await avaliar(primeiro, CLIENTE, { nota: 5 });
  await avaliar(segundo, CLIENTE, { nota: 3, observacoes: "Resolvido." });

  const semToken = await request("GET", "/api/atendimento/avaliacoes");
  const cliente = await request("GET", "/api/atendimento/avaliacoes", { token: await jwt(CLIENTE) });
  assert.equal(semToken.status, 401);
  assert.equal(cliente.status, 403);

  const lista = await request("GET", "/api/atendimento/avaliacoes?nota=5&status=pendente", {
    token: await jwt(),
  });
  assert.equal(lista.status, 200);
  assert.equal(lista.body.avaliacoes.length, 1);
  assert.equal(lista.body.avaliacoes[0].id, a.body.avaliacao.id);
  assert.deepEqual(lista.body.indicadores, { quantidade: 2, media: 4 });
  assert.equal(lista.body.proximoCursor, null);

  const invalido = await request("GET", "/api/atendimento/avaliacoes?campo=indevido", {
    token: await jwt(),
  });
  assert.equal(invalido.status, 400);
});

test("detalhe mostra conteúdo real e moderação confirmada gera histórico", async () => {
  const solicitacaoId = await pedido();
  await concluir(solicitacaoId);
  const criada = await avaliar(solicitacaoId);
  const id = criada.body.avaliacao.id;

  const detalhe = await request("GET", `/api/atendimento/avaliacoes/${id}`, {
    token: await jwt(),
  });
  assert.equal(detalhe.status, 200);
  assert.equal(detalhe.body.avaliacao.cliente.email, "cliente@example.test");
  assert.equal(detalhe.body.avaliacao.servico.nome, "Hardware");
  assert.equal(detalhe.body.historico.length, 0);

  const semConfirmacao = await request("PATCH", `/api/atendimento/avaliacoes/${id}/status`, {
    token: await jwt(), body: { status: "publicada", versao: 0, motivo: "Conteúdo revisado." },
  });
  assert.equal(semConfirmacao.status, 400);

  const publicada = await request("PATCH", `/api/atendimento/avaliacoes/${id}/status`, {
    token: await jwt(),
    body: { status: "publicada", versao: 0, motivo: "Conteúdo revisado.", confirmado: true },
  });
  assert.equal(publicada.status, 200);
  assert.equal(publicada.body.avaliacao.status, "publicada");
  assert.equal(publicada.body.avaliacao.versao, 1);

  const antiga = await request("PATCH", `/api/atendimento/avaliacoes/${id}/status`, {
    token: await jwt(),
    body: { status: "oculta", versao: 0, motivo: "Tela antiga.", confirmado: true },
  });
  assert.equal(antiga.status, 409);

  const oculta = await request("PATCH", `/api/atendimento/avaliacoes/${id}/status`, {
    token: await jwt(),
    body: { status: "oculta", versao: 1, motivo: "Revisão solicitada.", confirmado: true },
  });
  assert.equal(oculta.status, 200);
  assert.equal(oculta.body.avaliacao.versao, 2);

  const depois = await request("GET", `/api/atendimento/avaliacoes/${id}`, {
    token: await jwt(),
  });
  assert.equal(depois.body.historico.length, 2);
  assert.equal(depois.body.historico[0].administrador.id, ADMIN);
  assert.equal(depois.body.historico[0].motivo, "Revisão solicitada.");
  assert.equal(depois.body.avaliacao.nota, 5);
  assert.equal(depois.body.avaliacao.observacoes, "Atendimento cuidadoso e solução confirmada.");
});

test("administrador não altera conteúdo e falha de auditoria desfaz moderação", async () => {
  const solicitacaoId = await pedido();
  await concluir(solicitacaoId);
  const criada = await avaliar(solicitacaoId);
  const id = criada.body.avaliacao.id;

  await assert.rejects(
    admin("UPDATE aw.avaliacoes SET nota=1 WHERE id=$1", [id]),
  );
  const corpoExtra = await request("PATCH", `/api/atendimento/avaliacoes/${id}/status`, {
    token: await jwt(),
    body: {
      status: "publicada", versao: 0, motivo: "Tentativa indevida.",
      confirmado: true, nota: 1,
    },
  });
  assert.equal(corpoExtra.status, 400);

  await admin("REVOKE INSERT ON aw.avaliacoes_eventos FROM aw_api");
  const falha = await request("PATCH", `/api/atendimento/avaliacoes/${id}/status`, {
    token: await jwt(),
    body: { status: "publicada", versao: 0, motivo: "Publicar.", confirmado: true },
  });
  assert.equal(falha.status, 500);
  const estado = await admin("SELECT status,versao FROM aw.avaliacoes WHERE id=$1", [id]);
  assert.deepEqual(estado.rows[0], { status: "pendente", versao: 0 });
});
