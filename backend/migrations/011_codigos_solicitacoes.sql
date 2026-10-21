BEGIN;
SET LOCAL ROLE admin;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM aw.schema_migrations WHERE versao = '010_avaliacoes'
  ) THEN
    RAISE EXCEPTION 'Aplique 010_avaliacoes antes desta migracao.';
  END IF;
END;
$$;

-- O UUID continua sendo a chave interna. "codigo" é a identificação curta
-- exibida para a equipe e para o cliente.
ALTER TABLE aw.solicitacoes_orcamento
  ADD COLUMN codigo varchar(32);

-- Mantém uma sequência independente para cada tipo de serviço e ano.
CREATE TABLE aw.solicitacoes_numeracao (
  prefixo varchar(4) NOT NULL,
  ano integer NOT NULL CHECK (ano BETWEEN 2000 AND 9999),
  ultimo_numero integer NOT NULL CHECK (ultimo_numero >= 0),
  PRIMARY KEY (prefixo, ano)
);

CREATE OR REPLACE FUNCTION aw.definir_codigo_solicitacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = aw, pg_temp
AS $$
DECLARE
  codigo_prefixo varchar(4);
  codigo_ano integer;
  proximo_numero integer;
BEGIN
  IF NEW.codigo IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT CASE servico.slug
    WHEN 'hardware' THEN 'OS'
    WHEN 'redes' THEN 'RED'
    WHEN 'desenvolvimento-web' THEN 'WEB'
    WHEN 'manutencao' THEN 'MAN'
    WHEN 'outro' THEN 'OUT'
    ELSE 'SOL'
  END
  INTO codigo_prefixo
  FROM aw.servicos AS servico
  WHERE servico.id = NEW.servico_id;

  codigo_prefixo := COALESCE(codigo_prefixo, 'SOL');
  codigo_ano := EXTRACT(YEAR FROM NEW.criada_em AT TIME ZONE 'America/Sao_Paulo');

  INSERT INTO aw.solicitacoes_numeracao (prefixo, ano, ultimo_numero)
  VALUES (codigo_prefixo, codigo_ano, 1)
  ON CONFLICT (prefixo, ano) DO UPDATE
    SET ultimo_numero = aw.solicitacoes_numeracao.ultimo_numero + 1
  RETURNING ultimo_numero INTO proximo_numero;

  NEW.codigo := format('%s-%s-%s', codigo_prefixo, codigo_ano,
    lpad(proximo_numero::text, 4, '0'));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION aw.definir_codigo_solicitacao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION aw.definir_codigo_solicitacao() TO aw_api;

-- As solicitações já existentes também recebem um código, sem alterar seus UUIDs.
-- A numeração respeita a data de criação para preservar a ordem histórica.
WITH codigos_historicos AS (
  SELECT solicitacao.id,
    COALESCE(CASE servico.slug
      WHEN 'hardware' THEN 'OS'
      WHEN 'redes' THEN 'RED'
      WHEN 'desenvolvimento-web' THEN 'WEB'
      WHEN 'manutencao' THEN 'MAN'
      WHEN 'outro' THEN 'OUT'
      ELSE 'SOL'
    END, 'SOL') AS prefixo,
    EXTRACT(YEAR FROM solicitacao.criada_em AT TIME ZONE 'America/Sao_Paulo')::integer AS ano,
    row_number() OVER (
      PARTITION BY COALESCE(CASE servico.slug
        WHEN 'hardware' THEN 'OS'
        WHEN 'redes' THEN 'RED'
        WHEN 'desenvolvimento-web' THEN 'WEB'
        WHEN 'manutencao' THEN 'MAN'
        WHEN 'outro' THEN 'OUT'
        ELSE 'SOL'
      END, 'SOL'), EXTRACT(YEAR FROM solicitacao.criada_em AT TIME ZONE 'America/Sao_Paulo')
      ORDER BY solicitacao.criada_em, solicitacao.id
    ) AS numero
  FROM aw.solicitacoes_orcamento AS solicitacao
  LEFT JOIN aw.servicos AS servico ON servico.id = solicitacao.servico_id
  WHERE solicitacao.codigo IS NULL
)
UPDATE aw.solicitacoes_orcamento AS solicitacao
SET codigo = format('%s-%s-%s', historico.prefixo, historico.ano,
  lpad(historico.numero::text, 4, '0'))
FROM codigos_historicos AS historico
WHERE solicitacao.id = historico.id;

INSERT INTO aw.solicitacoes_numeracao (prefixo, ano, ultimo_numero)
SELECT split_part(codigo, '-', 1), split_part(codigo, '-', 2)::integer,
  max(split_part(codigo, '-', 3)::integer)
FROM aw.solicitacoes_orcamento
GROUP BY split_part(codigo, '-', 1), split_part(codigo, '-', 2)
ON CONFLICT (prefixo, ano) DO UPDATE
  SET ultimo_numero = EXCLUDED.ultimo_numero;

CREATE TRIGGER solicitacao_codigo
BEFORE INSERT OR UPDATE ON aw.solicitacoes_orcamento
FOR EACH ROW
EXECUTE FUNCTION aw.definir_codigo_solicitacao();

ALTER TABLE aw.solicitacoes_orcamento
  ALTER COLUMN codigo SET NOT NULL,
  ADD CONSTRAINT solicitacoes_codigo_formato_check
    CHECK (codigo ~ '^(OS|RED|WEB|MAN|OUT|SOL)-[0-9]{4}-[0-9]{4,}$'),
  ADD CONSTRAINT solicitacoes_codigo_unico UNIQUE (codigo);

CREATE INDEX solicitacoes_codigo_busca_idx
  ON aw.solicitacoes_orcamento (codigo);

GRANT SELECT (codigo) ON aw.solicitacoes_orcamento TO aw_api;

INSERT INTO aw.schema_migrations (versao) VALUES ('011_codigos_solicitacoes');
COMMIT;
