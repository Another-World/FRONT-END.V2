BEGIN;
SET LOCAL ROLE admin;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM aw.schema_migrations WHERE versao = '009_consulta_usuarios'
  ) THEN
    RAISE EXCEPTION 'Aplique 009_consulta_usuarios antes desta migracao.';
  END IF;
END;
$$;

-- Avaliações novas pertencem à identidade atual (UUID do Supabase) e a uma
-- solicitação concluída. A tabela legada public.tb_avaliacoes é preservada.
CREATE TABLE aw.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL UNIQUE
    REFERENCES aw.solicitacoes_orcamento(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL
    REFERENCES aw.usuarios(id) ON DELETE RESTRICT,
  nota smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
  observacoes text CHECK (
    observacoes IS NULL OR (
      length(btrim(observacoes)) BETWEEN 1 AND 2000
      AND observacoes !~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  ),
  sugestoes text CHECK (
    sugestoes IS NULL OR (
      length(btrim(sugestoes)) BETWEEN 1 AND 2000
      AND sugestoes !~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  ),
  status varchar(10) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'publicada', 'oculta')),
  versao integer NOT NULL DEFAULT 0 CHECK (versao >= 0),
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX avaliacoes_status_criada_idx
  ON aw.avaliacoes(status, criada_em DESC, id DESC);
CREATE INDEX avaliacoes_nota_criada_idx
  ON aw.avaliacoes(nota, criada_em DESC, id DESC);
CREATE INDEX avaliacoes_usuario_criada_idx
  ON aw.avaliacoes(usuario_id, criada_em DESC, id DESC);

CREATE TABLE aw.avaliacoes_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL
    REFERENCES aw.avaliacoes(id) ON DELETE RESTRICT,
  administrador_id uuid NOT NULL
    REFERENCES aw.usuarios(id) ON DELETE RESTRICT,
  status_anterior varchar(10) NOT NULL
    CHECK (status_anterior IN ('pendente', 'publicada', 'oculta')),
  status_novo varchar(10) NOT NULL
    CHECK (status_novo IN ('publicada', 'oculta')),
  motivo varchar(500) NOT NULL CHECK (length(btrim(motivo)) BETWEEN 1 AND 500),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (status_anterior <> status_novo)
);

CREATE INDEX avaliacoes_eventos_ordem_idx
  ON aw.avaliacoes_eventos(avaliacao_id, criado_em DESC, id DESC);

-- Conteúdo e vínculos são imutáveis. A equipe só publica ou oculta; cada
-- mudança incrementa a versão para impedir que duas telas se sobrescrevam.
CREATE FUNCTION aw.proteger_avaliacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW.id, NEW.solicitacao_id, NEW.usuario_id, NEW.nota,
    NEW.observacoes, NEW.sugestoes, NEW.criada_em
  ) IS DISTINCT FROM (
    OLD.id, OLD.solicitacao_id, OLD.usuario_id, OLD.nota,
    OLD.observacoes, OLD.sugestoes, OLD.criada_em
  ) THEN
    RAISE EXCEPTION 'Conteudo e vinculos da avaliacao sao imutaveis'
      USING ERRCODE = '23514';
  END IF;

  NEW.versao := OLD.versao;
  NEW.atualizada_em := OLD.atualizada_em;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'pendente' AND NEW.status IN ('publicada', 'oculta'))
      OR (OLD.status = 'publicada' AND NEW.status = 'oculta')
      OR (OLD.status = 'oculta' AND NEW.status = 'publicada')
    ) THEN
      RAISE EXCEPTION 'Transicao de avaliacao invalida'
        USING ERRCODE = '23514';
    END IF;
    NEW.versao := OLD.versao + 1;
    NEW.atualizada_em := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER avaliacao_protegida
BEFORE UPDATE ON aw.avaliacoes
FOR EACH ROW EXECUTE FUNCTION aw.proteger_avaliacao();

REVOKE ALL ON aw.avaliacoes, aw.avaliacoes_eventos FROM PUBLIC;
REVOKE ALL ON FUNCTION aw.proteger_avaliacao() FROM PUBLIC;

GRANT SELECT (
  id, solicitacao_id, usuario_id, nota, observacoes, sugestoes,
  status, versao, criada_em, atualizada_em
) ON aw.avaliacoes TO aw_api;
GRANT INSERT (solicitacao_id, usuario_id, nota, observacoes, sugestoes)
  ON aw.avaliacoes TO aw_api;
GRANT UPDATE (status) ON aw.avaliacoes TO aw_api;

GRANT SELECT (
  id, avaliacao_id, administrador_id, status_anterior,
  status_novo, motivo, criado_em
) ON aw.avaliacoes_eventos TO aw_api;
GRANT INSERT (
  avaliacao_id, administrador_id, status_anterior, status_novo, motivo
) ON aw.avaliacoes_eventos TO aw_api;

INSERT INTO aw.schema_migrations(versao) VALUES ('010_avaliacoes');
COMMIT;
