import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { PGlite } from "@electric-sql/pglite";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { criarApp } from "../src/app.js";

const A = randomUUID();
const B = randomUUID();
const C = randomUUID();
const caminho = "/api/atendimento/solicitacoes";
let db, pool, server, base, privateKey, resolverChaves;
let fila = Promise.resolve();
async function reservar() {
  const anterior = fila;
  let liberar;
  fila = new Promise(resolve => { liberar = resolve; });
  await anterior;
  return liberar;
}
async function query(sql, parametros) {
  const r = await db.query(sql, parametros);
  return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 };
}
async function admin(sql, parametros) {
  const liberar = await reservar();
  try { await db.exec("RESET ROLE"); return await db.query(sql, parametros); }
  finally { await db.exec("SET ROLE aw_api"); liberar(); }
}
async function jwt(id = A, overrides = {}) {
  const { issuer = "https://teste.supabase.co/auth/v1", audience = "authenticated", exp = "1h", ...claims } = overrides;
  return new SignJWT({ email: "teste@example.test", role: "authenticated", is_anonymous: false, ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "teste" }).setSubject(id)
    .setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(exp).sign(privateKey);
}
async function request(method, path = caminho, { token, body, chave } = {}) {
  const r = await fetch(base + path, {
    method, headers: {
      ...(token !== undefined ? { Authorization: token === "" ? "" : `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(chave ? { "Idempotency-Key": chave } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, headers: r.headers, body: await r.json() };
}
async function pedido(id = B, overrides = {}) {
  const r = await request("POST", "/api/solicitacoes", {
    token: id ? await jwt(id) : undefined, chave: randomUUID(),
    body: { nome: "Contato de teste", email: "contato@example.test", telefone: "11999990000",
      servicoSlug: "hardware", cep: "05051000", mensagem: "Mensagem privada de teste", ...overrides },
  });
  assert.equal(r.status, 201);
  return r.body.id;
}
async function alterar(id, status = "em_contato", versao = 0, token) {
  return request("PATCH", `${caminho}/${id}/status`, { token: token ?? await jwt(), body: { status, versao, confirmado: true } });
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
  for (const f of ["003_protecao_solicitacoes.sql", "004_usuarios.sql", "005_solicitacoes_conta.sql", "006_atendimento.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
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
      return { query, release: liberar };
    },
  };
});
beforeEach(async () => {
  await db.exec(`RESET ROLE;
    TRUNCATE aw.solicitacoes_eventos, aw.solicitacoes_orcamento, aw.usuarios CASCADE;
    GRANT INSERT (solicitacao_id, tipo, detalhes) ON aw.solicitacoes_eventos TO aw_api;`);
  await db.query("INSERT INTO aw.usuarios (id,nome,email,papel) VALUES ($1,'Administrador','admin@example.test','admin'), ($2,'Cliente','cliente@example.test','cliente'), ($3,'Equipe','equipe@example.test','admin')", [A,B,C]);
  await db.exec("SET ROLE aw_api;");
  server = criarApp({ pool, autenticacao: { supabaseUrl: "https://teste.supabase.co", resolverChaves }, limiteEnvios: 100 })
    .listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { await new Promise(resolve => server.close(resolve)); });
after(async () => { await db?.close(); });

test("006 concede só campos necessários e impede edição de dono/contato/papel e exclusão", async () => {
  const r = await pool.query(`SELECT
    has_column_privilege('aw_api','aw.solicitacoes_orcamento','email_contato','SELECT') AS contato,
    has_column_privilege('aw_api','aw.solicitacoes_orcamento','status','UPDATE') AS status,
    has_column_privilege('aw_api','aw.solicitacoes_orcamento','versao_status','UPDATE') AS editar_versao,
    has_column_privilege('aw_api','aw.solicitacoes_orcamento','usuario_id','UPDATE') AS dono,
    has_column_privilege('aw_api','aw.solicitacoes_orcamento','email_contato','UPDATE') AS editar_contato,
    has_column_privilege('aw_api','aw.usuarios','papel','UPDATE') AS papel,
    has_column_privilege('aw_api','aw.usuarios','ativo','UPDATE') AS ativo,
    has_table_privilege('aw_api','aw.solicitacoes_orcamento','DELETE') AS excluir,
    has_table_privilege('aw_api','aw.solicitacoes_eventos','UPDATE') AS editar_eventos`);
  assert.deepEqual(r.rows[0], { contato:true,status:true,editar_versao:false,dono:false,editar_contato:false,papel:false,ativo:false,excluir:false,editar_eventos:false });
});

for (const [nome, overrides] of [
  ["expirado", { exp: Math.floor(Date.now()/1000)-60 }],
  ["outro projeto", { issuer:"https://outro.supabase.co/auth/v1" }],
  ["outro público", { audience:"anon" }],
  ["service_role", { role:"service_role" }],
  ["anônimo Supabase", { is_anonymous:true }],
]) {
  test(`painel recusa JWT ${nome} em lista, detalhe e status`, async () => {
    const id = await pedido();
    const token = await jwt(A, overrides);
    for (const [method,path,body] of [["GET",caminho],["GET",`${caminho}/${id}`],["PATCH",`${caminho}/${id}/status`,{status:"aceito",versao:0}]]) {
      assert.equal((await request(method,path,{token,body})).status,401);
    }
  });
}
test("painel recusa ausência, token vazio e token forjado sem revelar dados", async () => {
  for (const token of [undefined,"","token.falso.invalido"]) {
    const r = await request("GET",caminho,{token});
    assert.equal(r.status,401);
    assert.equal(r.headers.get("cache-control"),"no-store");
  }
});
test("cliente e metadata admin não concedem acesso; painel não permite autopromoção", async () => {
  const id = await pedido();
  const token = await jwt(B,{user_metadata:{papel:"admin"},app_metadata:{papel:"admin"}});
  for (const [method,path,body] of [["GET",caminho],["GET",`${caminho}/${id}`],["PATCH",`${caminho}/${id}/status`,{status:"aceito",versao:0}]]) {
    const r = await request(method,path,{token,body});
    assert.equal(r.status,403);
    assert.ok(!JSON.stringify(r.body).includes("Mensagem privada"));
  }
  assert.equal((await request("PATCH","/api/perfil",{token,body:{nome:"Teste",telefone:null,empresa:null,papel:"admin"}})).status,400);
});
test("administrador desativado ou rebaixado perde acesso com o mesmo JWT", async () => {
  const token = await jwt();
  await admin("UPDATE aw.usuarios SET ativo=false WHERE id=$1",[A]);
  assert.equal((await request("GET",caminho,{token})).status,403);
  await admin("UPDATE aw.usuarios SET ativo=true, papel='cliente' WHERE id=$1",[A]);
  assert.equal((await request("GET",caminho,{token})).status,403);
});
test("admin vê visitantes e contas em lista mínima, detalhe privado e histórico limitado", async () => {
  const vinculado = await pedido();
  const visitante = await pedido(null);
  const token = await jwt();
  const lista = await request("GET",caminho,{token});
  assert.equal(lista.status,200);
  assert.equal(lista.headers.get("cache-control"),"no-store");
  assert.deepEqual(new Set(lista.body.solicitacoes.map(x=>x.id)),new Set([vinculado,visitante]));
  assert.ok(!JSON.stringify(lista.body).includes("contato@example.test"));
  await admin(`INSERT INTO aw.solicitacoes_eventos (solicitacao_id,tipo) SELECT $1,'criada' FROM generate_series(1,60)`,[visitante]);
  const detalhe = await request("GET",`${caminho}/${visitante}`,{token});
  assert.equal(detalhe.status,200);
  assert.equal(detalhe.body.solicitacao.mensagem,"Mensagem privada de teste");
  assert.equal(detalhe.body.solicitacao.contato.email,"contato@example.test");
  assert.equal(detalhe.body.historico.length,50);
  assert.equal(detalhe.body.solicitacao.contato.whatsappAutorizado,false);
  assert.ok(!("idempotencia_hash" in detalhe.body.solicitacao));
});
test("paginação administrativa preserva microssegundos, UUID e filtro de status", async () => {
  const ids = [await pedido(),await pedido(null),await pedido()];
  for (let i=0;i<ids.length;i++) await admin("UPDATE aw.solicitacoes_orcamento SET criada_em=$2 WHERE id=$1",[ids[i],`2026-10-14T12:00:00.00000${i+1}Z`]);
  const token = await jwt();
  const vistos=[];
  let cursor;
  do {
    const r = await request("GET",`${caminho}?limite=1&status=em_analise${cursor?`&cursor=${cursor}`:""}`,{token});
    assert.equal(r.status,200);
    vistos.push(...r.body.solicitacoes.map(x=>x.id));
    cursor = r.body.proximoCursor;
  } while(cursor);
  assert.deepEqual(vistos,[...ids].reverse());
  await alterar(ids[0],"aceito");
  const filtrado = await request("GET",`${caminho}?status=aceito`,{token});
  assert.deepEqual(filtrado.body.solicitacoes.map(x=>x.id),[ids[0]]);
});
test("painel recusa filtros extras, cursor inválido, corpo extra e status fora do enum", async () => {
  const id = await pedido();
  const token = await jwt();
  for (const q of ["userId="+B,"status=inventado","limite=0","cursor=aaa","email=teste@example.test"]) {
    assert.equal((await request("GET",`${caminho}?${q}`,{token})).status,400);
  }
  for (const body of [{status:"admin",versao:0},{status:"aceito"},{status:"aceito",versao:-1},{status:"aceito",versao:0,usuario_id:A},{status:"aceito",versao:0,papel:"admin"}]) {
    assert.equal((await request("PATCH",`${caminho}/${id}/status`,{token,body})).status,400);
  }
  assert.equal((await request("GET",`${caminho}/nao-uuid`,{token})).status,400);
  assert.equal((await request("GET",`${caminho}/${randomUUID()}`,{token})).status,404);
});
test("alteração de status registra ator/antes/depois, incrementa versão e aparece ao cliente", async () => {
  const id=await pedido();
  const r=await alterar(id,"aceito");
  assert.equal(r.status,200);
  assert.equal(r.body.solicitacao.versao,1);
  assert.equal(r.body.solicitacao.status,"aceito");
  const evento=(await admin("SELECT detalhes FROM aw.solicitacoes_eventos WHERE solicitacao_id=$1 AND tipo='status_alterado'",[id])).rows[0];
  assert.deepEqual(evento.detalhes,{administradorId:A,statusAnterior:"em_analise",statusNovo:"aceito",versaoAnterior:0,versaoNova:1,acao:"aceite",confirmado:true});
  const cliente=await request("GET","/api/solicitacoes",{token:await jwt(B)});
  assert.equal(cliente.body.solicitacoes[0].status,"aceito");
  assert.ok(!JSON.stringify(cliente.body).includes("Mensagem privada"));
});
test("status igual não duplica eventos; versão antiga retorna conflito sem sobrescrever", async () => {
  const id=await pedido();
  assert.equal((await alterar(id,"em_analise")).body.solicitacao.versao,0);
  await alterar(id,"em_contato");
  assert.equal((await alterar(id,"em_contato",1)).status,200);
  assert.equal((await alterar(id,"concluida",0)).status,409);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_eventos WHERE tipo='status_alterado'")).rows[0].n,1);
});
test("falha de histórico reverte status, versão e data", async () => {
  const id=await pedido();
  const antes=(await admin("SELECT status,versao_status,atualizada_em FROM aw.solicitacoes_orcamento WHERE id=$1",[id])).rows[0];
  await admin("REVOKE INSERT (detalhes) ON aw.solicitacoes_eventos FROM aw_api");
  assert.equal((await alterar(id)).status,500);
  const depois=(await admin("SELECT status,versao_status,atualizada_em FROM aw.solicitacoes_orcamento WHERE id=$1",[id])).rows[0];
  assert.deepEqual(depois,antes);
});
test("duas alterações com mesma versão aceitam uma e recusam outra", async () => {
  const id=await pedido();
  const resultados=await Promise.all([alterar(id,"em_contato"),alterar(id,"aceito",0,await jwt(C))]);
  assert.deepEqual(resultados.map(x=>x.status).sort(),[200,409]);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_eventos WHERE tipo='status_alterado'")).rows[0].n,1);
});

test("alteração externa de status avança a versão e impede sobrescrita pelo painel", async () => {
  const id=await pedido();
  await admin("UPDATE aw.solicitacoes_orcamento SET status='em_contato',versao_status=900 WHERE id=$1",[id]);
  const row=(await admin("SELECT versao_status FROM aw.solicitacoes_orcamento WHERE id=$1",[id])).rows[0];
  assert.equal(row.versao_status,1);
  assert.equal((await alterar(id,"aceito",0)).status,409);
  assert.equal((await alterar(id,"aceito",1)).body.solicitacao.versao,2);
});
test("revalidação transacional bloqueia revogação entre middleware e operação", async () => {
  const id=await pedido();
  const conectar=pool.connect;
  pool.connect=async () => {
    pool.connect=conectar;
    await admin("UPDATE aw.usuarios SET papel='cliente' WHERE id=$1",[A]);
    return conectar();
  };
  try {
    assert.equal((await alterar(id)).status,403);
    assert.equal((await admin("SELECT status FROM aw.solicitacoes_orcamento WHERE id=$1",[id])).rows[0].status,"em_analise");
  } finally { pool.connect=conectar; }
});
test("grants administrativos não ampliam a lista do cliente nem expõem contato/histórico", async () => {
  const proprio=await pedido(B);
  await pedido(C); await pedido(null);
  const r=await request("GET","/api/solicitacoes",{token:await jwt(B)});
  assert.equal(r.status,200);
  assert.deepEqual(r.body.solicitacoes.map(x=>x.id),[proprio]);
  assert.ok(!JSON.stringify(r.body).includes("contato@example.test"));
  assert.ok(!JSON.stringify(r.body).includes("Mensagem privada"));
  assert.ok(!("historico" in r.body));
});

test("busca por nome combina status e paginação sem perder microssegundos", async () => {
  const ids = [await pedido(B,{nome:"Pessoa Aurora"}), await pedido(null,{nome:"Equipe AURORA"}), await pedido(C,{nome:"Outra Aurora"})];
  await pedido(B,{nome:"Pessoa Diferente"});
  await alterar(ids[2],"aceito");
  for (let i=0;i<ids.length;i++) await admin("UPDATE aw.solicitacoes_orcamento SET criada_em=$2 WHERE id=$1",[ids[i],`2026-10-15T12:00:00.00000${i+1}Z`]);
  const token=await jwt();
  const vistos=[];
  let cursor;
  do {
    const r=await request("GET",`${caminho}?limite=1&status=em_analise&busca=aUrOrA${cursor?`&cursor=${cursor}`:""}`,{token});
    assert.equal(r.status,200);
    vistos.push(...r.body.solicitacoes.map(x=>x.id));
    assert.ok(!JSON.stringify(r.body).includes("contato@example.test"));
    cursor=r.body.proximoCursor;
  } while(cursor);
  assert.deepEqual(vistos,[ids[1],ids[0]]);
});
test("busca aceita protocolo e trata curingas e SQL como texto literal", async () => {
  const especial=await pedido(B,{nome:"Contato 50%_Especial"});
  await pedido(null,{nome:"Contato Comum"});
  const token=await jwt();
  for (const busca of [especial.toUpperCase(),"%_", "50%_especial"]) {
    const r=await request("GET",`${caminho}?busca=${encodeURIComponent(busca)}`,{token});
    assert.equal(r.status,200);
    assert.deepEqual(r.body.solicitacoes.map(x=>x.id),[especial]);
  }
  const r=await request("GET",`${caminho}?busca=${encodeURIComponent("' OR true --")}`,{token});
  assert.equal(r.status,200);
  assert.equal(r.body.solicitacoes.length,0);
});
test("busca recusa termos inválidos e continua restrita a administrador", async () => {
  const token=await jwt();
  for (const q of ["busca=a","busca="+"a".repeat(121),"busca=%20%20","busca=aa&busca=bb","busca[x]=aa"]) {
    assert.equal((await request("GET",`${caminho}?${q}`,{token})).status,400);
  }
  assert.equal((await request("GET",`${caminho}?busca=contato`,{token:await jwt(B,{user_metadata:{role:"admin"}})})).status,403);
});
test("pedidos encerrados oferecem somente reabertura confirmada para Em análise", async () => {
  for (const status of ["negado","cancelada","concluida"]) {
    const id=await pedido();
    await admin("UPDATE aw.solicitacoes_orcamento SET status=$2 WHERE id=$1",[id,status]);
    const r=await request("GET",`${caminho}/${id}`,{token:await jwt()});
    assert.equal(r.status,200);
    assert.equal(r.body.solicitacao.acoesDisponiveis.length,1);
    assert.equal(r.body.solicitacao.acoesDisponiveis[0].status,"em_analise");
    assert.match(r.body.solicitacao.acoesDisponiveis[0].confirmacao,/Reabrir/);
  }
});
test("reabertura exige confirmação booleana explícita sem alterar pedido ou histórico", async () => {
  const id=await pedido();
  await admin("UPDATE aw.solicitacoes_orcamento SET status='negado' WHERE id=$1",[id]);
  const token=await jwt();
  for (const confirmado of [undefined,false,"true"]) {
    const body={status:"em_analise",versao:1,...(confirmado!==undefined?{confirmado}:{})};
    assert.equal((await request("PATCH",`${caminho}/${id}/status`,{token,body})).status,400);
  }
  assert.deepEqual((await admin("SELECT status,versao_status FROM aw.solicitacoes_orcamento WHERE id=$1",[id])).rows[0],{status:"negado",versao_status:1});
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_eventos WHERE tipo='status_alterado'")).rows[0].n,0);
});
test("reabrir cada status encerrado grava confirmação, autor, origem e versão e aparece ao cliente", async () => {
  for (const status of ["negado","cancelada","concluida"]) {
    const id=await pedido();
    await admin("UPDATE aw.solicitacoes_orcamento SET status=$2 WHERE id=$1",[id,status]);
    const r=await alterar(id,"em_analise",1);
    assert.equal(r.status,200);
    assert.equal(r.body.solicitacao.status,"em_analise");
    assert.equal(r.body.solicitacao.versao,2);
    const evento=(await admin("SELECT detalhes FROM aw.solicitacoes_eventos WHERE solicitacao_id=$1 AND tipo='status_alterado'",[id])).rows[0];
    assert.deepEqual(evento.detalhes,{administradorId:A,statusAnterior:status,statusNovo:"em_analise",versaoAnterior:1,versaoNova:2,acao:"reabertura",confirmado:true});
    const lista=await request("GET","/api/solicitacoes",{token:await jwt(B)});
    assert.equal(lista.body.solicitacoes.find(x=>x.id===id).status,"em_analise");
  }
});
test("pedido encerrado não pula diretamente para aceite, contato ou outro encerramento", async () => {
  for (const status of ["negado","cancelada","concluida"]) {
    const id=await pedido();
    await admin("UPDATE aw.solicitacoes_orcamento SET status=$2 WHERE id=$1",[id,status]);
    for (const alvo of ["aceito","em_contato","negado","cancelada","concluida"].filter(x=>x!==status)) {
      assert.equal((await alterar(id,alvo,1)).status,409);
    }
    assert.equal((await admin("SELECT status FROM aw.solicitacoes_orcamento WHERE id=$1",[id])).rows[0].status,status);
  }
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_eventos WHERE tipo='status_alterado'")).rows[0].n,0);
});
test("conclusão exige aceite anterior e decisões exigem confirmação", async () => {
  const token=await jwt();
  for (const status of ["aceito","negado","cancelada"]) {
    const id=await pedido();
    assert.equal((await request("PATCH",`${caminho}/${id}/status`,{token,body:{status,versao:0}})).status,400);
    assert.equal((await alterar(id,status)).status,200);
  }
  const id=await pedido();
  assert.equal((await alterar(id,"concluida")).status,409);
  assert.equal((await alterar(id,"aceito")).status,200);
  assert.equal((await request("PATCH",`${caminho}/${id}/status`,{token,body:{status:"concluida",versao:1,confirmado:false}})).status,400);
  assert.equal((await alterar(id,"concluida",1)).status,200);
});
test("mesmo status encerrado não pede nova confirmação nem duplica evento; versão antiga falha", async () => {
  const id=await pedido();
  await alterar(id,"negado");
  const token=await jwt();
  assert.equal((await request("PATCH",`${caminho}/${id}/status`,{token,body:{status:"negado",versao:1}})).status,200);
  assert.equal((await alterar(id,"em_analise",0)).status,409);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_eventos WHERE tipo='status_alterado'")).rows[0].n,1);
});
test("falha ao registrar reabertura desfaz status, versão e data", async () => {
  const id=await pedido();
  await admin("UPDATE aw.solicitacoes_orcamento SET status='cancelada' WHERE id=$1",[id]);
  const antes=(await admin("SELECT status,versao_status,atualizada_em FROM aw.solicitacoes_orcamento WHERE id=$1",[id])).rows[0];
  await admin("REVOKE INSERT (detalhes) ON aw.solicitacoes_eventos FROM aw_api");
  assert.equal((await alterar(id,"em_analise",1)).status,500);
  assert.deepEqual((await admin("SELECT status,versao_status,atualizada_em FROM aw.solicitacoes_orcamento WHERE id=$1",[id])).rows[0],antes);
});
test("duas reaberturas da mesma versão produzem um único evento", async () => {
  const id=await pedido();
  await admin("UPDATE aw.solicitacoes_orcamento SET status='negado' WHERE id=$1",[id]);
  const respostas=await Promise.all([alterar(id,"em_analise",1),alterar(id,"em_analise",1,await jwt(C))]);
  assert.deepEqual(respostas.map(r=>r.status).sort(),[200,409]);
  assert.equal((await admin("SELECT count(*)::int AS n FROM aw.solicitacoes_eventos WHERE tipo='status_alterado' AND detalhes->>'acao'='reabertura'")).rows[0].n,1);
});
