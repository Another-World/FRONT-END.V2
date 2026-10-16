BEGIN;
SET LOCAL ROLE admin;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM aw.schema_migrations WHERE versao='007_orcamentos') THEN
    RAISE EXCEPTION 'Aplique 007_orcamentos antes desta migracao.';
  END IF;
END $$;

-- A fila pertence ao banco privado da EC2. O destinatário é sempre copiado
-- do pedido; evento_chave impede dois envios para a mesma decisão/proposta.
ALTER TABLE aw.comunicacoes
  ADD COLUMN evento_chave varchar(100),
  ADD COLUMN orcamento_id uuid REFERENCES aw.orcamentos(id) ON DELETE RESTRICT,
  ADD COLUMN provedor_id varchar(200),
  ADD COLUMN iniciada_em timestamptz;
ALTER TABLE aw.comunicacoes DROP CONSTRAINT comunicacoes_tipo_check;
ALTER TABLE aw.comunicacoes ADD CONSTRAINT comunicacoes_tipo_check
  CHECK (tipo IN ('confirmacao','resposta','acompanhamento','decisao','proposta'));
CREATE UNIQUE INDEX comunicacoes_evento_chave_idx ON aw.comunicacoes(evento_chave)
  WHERE evento_chave IS NOT NULL;
CREATE INDEX comunicacoes_envio_idx ON aw.comunicacoes(agendada_em,id)
  WHERE canal='email' AND status='pendente';

-- Uma proposta em trânsito fica congelada, e não pode aparecer como enviada
-- enquanto o SES ainda não aceitou a mensagem.
ALTER TABLE aw.orcamentos DROP CONSTRAINT orcamentos_status_check;
ALTER TABLE aw.orcamentos ALTER COLUMN status TYPE varchar(16);
ALTER TABLE aw.orcamentos ADD CONSTRAINT orcamentos_status_check
  CHECK (status IN ('rascunho','aguardando_envio','enviada','aceita','recusada'));
DROP INDEX aw.orcamento_rascunho_unico_idx;
CREATE UNIQUE INDEX orcamento_aberto_unico_idx ON aw.orcamentos(solicitacao_id)
  WHERE status IN ('rascunho','aguardando_envio');
CREATE OR REPLACE FUNCTION aw.proteger_orcamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW.solicitacao_id,NEW.usuario_id,NEW.cliente,NEW.criada_em)
     IS DISTINCT FROM (OLD.id,OLD.solicitacao_id,OLD.usuario_id,OLD.cliente,OLD.criada_em) THEN
    RAISE EXCEPTION 'Vinculo e destinatario imutaveis' USING ERRCODE='23514';
  END IF;
  IF OLD.status<>'rascunho' AND
     (NEW.descricao,NEW.escopo,NEW.valor_centavos,NEW.prazo,NEW.condicoes,NEW.validade)
     IS DISTINCT FROM (OLD.descricao,OLD.escopo,OLD.valor_centavos,OLD.prazo,OLD.condicoes,OLD.validade) THEN
    RAISE EXCEPTION 'Proposta congelada nao pode ser editada' USING ERRCODE='23514';
  END IF;
  IF NEW.status<>OLD.status AND NOT (
    (OLD.status='rascunho' AND NEW.status IN ('aguardando_envio','enviada')) OR
    (OLD.status='aguardando_envio' AND NEW.status='enviada') OR
    (OLD.status='enviada' AND NEW.status IN ('aceita','recusada'))
  ) THEN
    RAISE EXCEPTION 'Transicao de proposta invalida' USING ERRCODE='23514';
  END IF;
  IF NEW.resposta_nota IS DISTINCT FROM OLD.resposta_nota AND NOT
     (OLD.status='enviada' AND NEW.status IN ('aceita','recusada')) THEN
    RAISE EXCEPTION 'Resposta somente na decisao' USING ERRCODE='23514';
  END IF;
  IF OLD.status='enviada' AND NEW.status IN ('aceita','recusada') AND
     length(btrim(coalesce(NEW.resposta_nota,'')))=0 THEN
    RAISE EXCEPTION 'Registre a origem da resposta' USING ERRCODE='23514';
  END IF;
  NEW.versao := OLD.versao+1;
  NEW.atualizada_em := now();
  NEW.enviada_em := OLD.enviada_em;
  NEW.respondida_em := OLD.respondida_em;
  IF NEW.status='enviada' AND OLD.status IN ('rascunho','aguardando_envio') THEN NEW.enviada_em:=now(); END IF;
  IF OLD.status='enviada' AND NEW.status IN ('aceita','recusada') THEN NEW.respondida_em:=now(); END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON aw.comunicacoes FROM PUBLIC;
GRANT SELECT (id,solicitacao_id,orcamento_id,canal,tipo,destinatario,assunto,conteudo,
  status,tentativas,ultimo_erro,agendada_em,enviada_em,criada_em,evento_chave,provedor_id,iniciada_em)
  ON aw.comunicacoes TO aw_api;
GRANT INSERT (solicitacao_id,orcamento_id,canal,tipo,destinatario,assunto,conteudo,evento_chave)
  ON aw.comunicacoes TO aw_api;
GRANT UPDATE (status,tentativas,ultimo_erro,agendada_em,enviada_em,provedor_id,iniciada_em)
  ON aw.comunicacoes TO aw_api;
INSERT INTO aw.schema_migrations(versao) VALUES ('008_emails');
COMMIT;
