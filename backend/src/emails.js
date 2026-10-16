import { gerarPropostaPdf } from "./propostaPdf.js";

const saudacao = (nome) => `Olá, ${nome?.trim() || "cliente"}.`;

export function textoDecisao({ nome, id, status }) {
  const decisao = status === "aceito"
    ? "Sua solicitação foi aceita pela equipe. Entraremos em contato para os próximos passos."
    : "Sua solicitação não foi aceita neste momento. Se precisar de esclarecimentos, responda a este e-mail.";
  return `${saudacao(nome)}\n\n${decisao}\n\nProtocolo: ${id}\n\nEquipe Another World`;
}

export function textoProposta({ nome, id }) {
  return `${saudacao(nome)}\n\nSegue em anexo a proposta comercial referente à solicitação ${id}. Confira valores, escopo, prazo e validade antes de responder a este e-mail.\n\nEquipe Another World`;
}

export async function registrarDecisao(client, pedido, status) {
  if (!["aceito", "negado"].includes(status)) return;
  await client.query(`
    INSERT INTO aw.comunicacoes
      (solicitacao_id,canal,tipo,destinatario,assunto,conteudo,evento_chave)
    VALUES ($1,'email','decisao',$2,$3,$4,$5)
    ON CONFLICT (evento_chave) WHERE evento_chave IS NOT NULL DO NOTHING
  `, [pedido.id, pedido.email_contato,
    `Atualização da solicitação ${pedido.id}`,
    textoDecisao({ nome: pedido.nome_contato, id: pedido.id, status }),
    `decisao:${pedido.id}:${pedido.versao_status}`]);
}

export async function registrarProposta(client, proposta) {
  await client.query(`
    INSERT INTO aw.comunicacoes
      (solicitacao_id,orcamento_id,canal,tipo,destinatario,assunto,conteudo,evento_chave)
    VALUES ($1,$2,'email','proposta',$3,$4,$5,$6)
    ON CONFLICT (evento_chave) WHERE evento_chave IS NOT NULL DO NOTHING
  `, [proposta.solicitacao_id, proposta.id, proposta.cliente.email,
    `Proposta comercial para solicitação ${proposta.solicitacao_id}`,
    textoProposta({ nome: proposta.cliente.nome, id: proposta.solicitacao_id }),
    `proposta:${proposta.id}`]);
}

// Uma chamada incerta ao provedor nunca é repetida automaticamente. Um
// operador deve reconciliar uma mensagem "processando" com o Gmail antes de
// decidir por qualquer novo envio: SMTP não deduplica por chave desta tabela.
export function criarProcessadorEmails(pool, enviar) {
  async function processarUm() {
    const c = await pool.connect();
    let mensagem;
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout='10s'");
      const r = await c.query(`
        SELECT id,solicitacao_id,orcamento_id,tipo,destinatario,assunto,conteudo
        FROM aw.comunicacoes
        WHERE canal='email' AND status='pendente' AND agendada_em<=now()
        ORDER BY agendada_em,id LIMIT 1 FOR UPDATE SKIP LOCKED
      `);
      mensagem = r.rows[0];
      if (mensagem) {
        await c.query(`
          UPDATE aw.comunicacoes SET status='processando', tentativas=tentativas+1,
            iniciada_em=now() WHERE id=$1`, [mensagem.id]);
      }
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally { c.release(); }
    if (!mensagem) return false;

    let identificador;
    try {
      let anexo;
      if (mensagem.tipo === "proposta") {
        const r = await pool.query(`
          SELECT * FROM aw.orcamentos WHERE id=$1 AND status='aguardando_envio'
        `, [mensagem.orcamento_id]);
        if (!r.rows[0]) throw new Error("proposta_indisponivel");
        const o = r.rows[0];
        anexo = await gerarPropostaPdf({
          id: o.id, solicitacaoId: o.solicitacao_id, cliente: o.cliente,
          descricao: o.descricao, escopo: o.escopo, valorCentavos: o.valor_centavos,
          prazo: o.prazo, condicoes: o.condicoes,
          validade: o.validade ? String(o.validade).slice(0,10) : null,
          versao: o.versao, criadaEm: o.criada_em,
        });
      }
      identificador = await enviar({
        destinatario: mensagem.destinatario,
        assunto: mensagem.assunto, conteudo: mensagem.conteudo,
        anexo, nomeArquivo: anexo ? `proposta-${mensagem.orcamento_id}.pdf` : null,
      });
      if (typeof identificador !== "string" || !identificador) throw new Error("sem_identificador");
    } catch (e) {
      // Inclusive timeout: talvez o SMTP tenha aceitado. Exigir reconciliação.
      await pool.query(`
        UPDATE aw.comunicacoes SET status='falhou',ultimo_erro='resultado_incerto'
        WHERE id=$1 AND status='processando'`, [mensagem.id]).catch(() => {});
      console.error(JSON.stringify({ evento: "email_nao_confirmado", id: mensagem.id,
        codigo: e.name ?? "interno" }));
      return true;
    }

    const fim = await pool.connect();
    try {
      await fim.query("BEGIN");
      await fim.query("SET LOCAL statement_timeout='10s'");
      const atualizado = await fim.query(`
        UPDATE aw.comunicacoes SET status='enviada',enviada_em=now(),
          provedor_id=$2,ultimo_erro=NULL
        WHERE id=$1 AND status='processando' RETURNING id
      `, [mensagem.id, identificador]);
      if (!atualizado.rowCount) throw new Error("email_em_estado_inesperado");
      if (mensagem.tipo === "proposta") {
        const proposta = await fim.query(`
          UPDATE aw.orcamentos SET status='enviada'
          WHERE id=$1 AND status='aguardando_envio' RETURNING id,versao
        `, [mensagem.orcamento_id]);
        if (!proposta.rowCount) throw new Error("proposta_em_estado_inesperado");
        await fim.query(`
          INSERT INTO aw.orcamentos_eventos(orcamento_id,tipo,detalhes)
          VALUES ($1,'email_aceito_pelo_provedor',$2::jsonb)
        `, [mensagem.orcamento_id, JSON.stringify({ mensagemId: mensagem.id,
          provedorId: identificador, versao: proposta.rows[0].versao })]);
      }
      await fim.query("COMMIT");
    } catch (e) {
      await fim.query("ROLLBACK").catch(() => {});
      // A aceitação pelo SMTP já pode ter ocorrido: não reenviar.
      console.error(JSON.stringify({ evento: "email_aceito_sem_confirmacao_local",
        id: mensagem.id, provedorId: identificador, codigo: e.code ?? "interno" }));
      throw e;
    } finally { fim.release(); }
    return true;
  }
  return { processarUm };
}
