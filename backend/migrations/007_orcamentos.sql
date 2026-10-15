BEGIN;
SET LOCAL ROLE admin;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM aw.schema_migrations WHERE versao='006_atendimento') THEN
    RAISE EXCEPTION 'Aplique 006_atendimento antes desta migracao.';
  END IF;
END $$;

-- Propostas comerciais são distintas dos pedidos. Contato e dono são uma
-- fotografia do pedido, copiada exclusivamente pelo servidor ao criar.
CREATE TABLE aw.orcamentos (
  id uuid PRIMARY KEY,
  solicitacao_id uuid NOT NULL REFERENCES aw.solicitacoes_orcamento(id) ON DELETE RESTRICT,
  usuario_id uuid REFERENCES aw.usuarios(id) ON DELETE RESTRICT,
  cliente jsonb NOT NULL CHECK (jsonb_typeof(cliente)='object'),
  descricao varchar(500) NOT NULL CHECK (length(btrim(descricao))>0),
  escopo text NOT NULL CHECK (length(btrim(escopo)) BETWEEN 1 AND 6000),
  valor_centavos integer NOT NULL CHECK (valor_centavos BETWEEN 1 AND 1000000000),
  prazo varchar(200) NOT NULL CHECK (length(btrim(prazo))>0),
  condicoes text NOT NULL DEFAULT '' CHECK (length(condicoes)<=4000),
  validade date,
  status varchar(12) NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviada','aceita','recusada')),
  versao integer NOT NULL DEFAULT 0 CHECK (versao>=0),
  resposta_nota varchar(1000),
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  enviada_em timestamptz,
  respondida_em timestamptz
);
CREATE UNIQUE INDEX orcamento_rascunho_unico_idx ON aw.orcamentos(solicitacao_id)
  WHERE status='rascunho';
CREATE INDEX orcamentos_criada_idx ON aw.orcamentos(criada_em DESC,id DESC);
CREATE INDEX orcamentos_status_idx ON aw.orcamentos(status,criada_em DESC,id DESC);
CREATE INDEX orcamentos_solicitacao_idx ON aw.orcamentos(solicitacao_id,criada_em DESC,id DESC);

CREATE FUNCTION aw.proteger_orcamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW.solicitacao_id,NEW.usuario_id,NEW.cliente,NEW.criada_em)
     IS DISTINCT FROM (OLD.id,OLD.solicitacao_id,OLD.usuario_id,OLD.cliente,OLD.criada_em) THEN
    RAISE EXCEPTION 'Vinculo e destinatario imutaveis' USING ERRCODE='23514';
  END IF;
  IF OLD.status<>'rascunho' AND
     (NEW.descricao,NEW.escopo,NEW.valor_centavos,NEW.prazo,NEW.condicoes,NEW.validade)
     IS DISTINCT FROM (OLD.descricao,OLD.escopo,OLD.valor_centavos,OLD.prazo,OLD.condicoes,OLD.validade) THEN
    RAISE EXCEPTION 'Proposta enviada nao pode ser editada' USING ERRCODE='23514';
  END IF;
  IF NEW.status<>OLD.status AND NOT (
    (OLD.status='rascunho' AND NEW.status='enviada') OR
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
  IF OLD.status='rascunho' AND NEW.status='enviada' THEN NEW.enviada_em:=now(); END IF;
  IF OLD.status='enviada' AND NEW.status IN ('aceita','recusada') THEN NEW.respondida_em:=now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orcamento_protegido BEFORE UPDATE ON aw.orcamentos
  FOR EACH ROW EXECUTE FUNCTION aw.proteger_orcamento();

CREATE TABLE aw.orcamentos_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES aw.orcamentos(id) ON DELETE RESTRICT,
  tipo varchar(32) NOT NULL,
  detalhes jsonb NOT NULL CHECK (jsonb_typeof(detalhes)='object'),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orcamentos_eventos_ordem_idx ON aw.orcamentos_eventos(orcamento_id,criado_em DESC,id DESC);
REVOKE ALL ON aw.orcamentos,aw.orcamentos_eventos FROM PUBLIC;
REVOKE ALL ON FUNCTION aw.proteger_orcamento() FROM PUBLIC;
GRANT SELECT ON aw.orcamentos,aw.orcamentos_eventos TO aw_api;
GRANT INSERT (id,solicitacao_id,usuario_id,cliente,descricao,escopo,valor_centavos,prazo,condicoes,validade)
  ON aw.orcamentos TO aw_api;
GRANT UPDATE (descricao,escopo,valor_centavos,prazo,condicoes,validade,status,resposta_nota)
  ON aw.orcamentos TO aw_api;
GRANT INSERT (orcamento_id,tipo,detalhes) ON aw.orcamentos_eventos TO aw_api;
INSERT INTO aw.schema_migrations(versao) VALUES ('007_orcamentos');
COMMIT;
