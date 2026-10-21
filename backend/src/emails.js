import { dadosPropostaPdf, gerarPropostaPdf } from "./propostaPdf.js";

const saudacao = (nome) => `Olá, ${nome?.trim() || "cliente"}.`;

export function textoDecisao({ nome, servico, status }) {
  const decisao = status === "aceito"
    ? `Sua solicitação para ${servico} foi aceita pela equipe. Entraremos em contato para os próximos passos.`
    : `Sua solicitação para ${servico} não foi aceita neste momento. Se precisar de esclarecimentos, responda a este e-mail.`;
  return `${saudacao(nome)}\n\n${decisao}\n\nEquipe Another World`;
}

export function textoProposta({ nome, servico }) {
  return `${saudacao(nome)}\n\nSegue em anexo a proposta comercial para o serviço ${servico}. Confira valores, escopo, prazo e validade antes de responder a este e-mail.\n\nEquipe Another World`;
}

async function nomeServico(client, solicitacaoId) {
  const resultado = await client.query(`
    SELECT v.nome AS servico_nome
    FROM aw.solicitacoes_orcamento s
    LEFT JOIN aw.servicos v ON v.id = s.servico_id
    WHERE s.id = $1
  `, [solicitacaoId]);
  return resultado.rows[0]?.servico_nome
    ?.replace(/[\u0000-\u001f\u007f]/g, " ").trim() || "Serviço solicitado";
}

export async function registrarDecisao(client, pedido, status) {
  if (!["aceito", "negado"].includes(status)) return;
  const servico = await nomeServico(client, pedido.id);
  const assunto = `Solicitação de ${servico} ${status === "aceito" ? "aceita" : "não aceita"}`;
  await client.query(`
    INSERT INTO aw.comunicacoes
      (solicitacao_id,canal,tipo,destinatario,assunto,conteudo,evento_chave)
    VALUES ($1,'email','decisao',$2,$3,$4,$5)
    ON CONFLICT (evento_chave) WHERE evento_chave IS NOT NULL DO NOTHING
  `, [pedido.id, pedido.email_contato,
    assunto,
    textoDecisao({ nome: pedido.nome_contato, servico, status }),
    `decisao:${pedido.id}:${pedido.versao_status}`]);
}

export async function registrarProposta(client, proposta) {
  const servico = await nomeServico(client, proposta.solicitacao_id);
  await client.query(`
    INSERT INTO aw.comunicacoes
      (solicitacao_id,orcamento_id,canal,tipo,destinatario,assunto,conteudo,evento_chave)
    VALUES ($1,$2,'email','proposta',$3,$4,$5,$6)
    ON CONFLICT (evento_chave) WHERE evento_chave IS NOT NULL DO NOTHING
  `, [proposta.solicitacao_id, proposta.id, proposta.cliente.email,
    `Proposta comercial para ${servico}`,
    textoProposta({ nome: proposta.cliente.nome, servico }),
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
          SELECT *, to_char(validade,'YYYY-MM-DD') AS validade_pdf
          FROM aw.orcamentos WHERE id=$1 AND status='aguardando_envio'
        `, [mensagem.orcamento_id]);
        if (!r.rows[0]) throw new Error("proposta_indisponivel");
        anexo = await gerarPropostaPdf(dadosPropostaPdf(r.rows[0]));
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
