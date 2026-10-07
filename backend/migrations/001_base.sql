BEGIN;

-- Isola as novas tabelas das tabelas antigas em public.
CREATE SCHEMA aw AUTHORIZATION admin;
REVOKE ALL ON SCHEMA aw FROM PUBLIC;

-- As tabelas criadas a seguir pertencem ao usuário admin.
-- A API receberá um usuário próprio, com permissões limitadas, depois.
SET LOCAL ROLE admin;

CREATE TABLE aw.schema_migrations (
    versao varchar(32) PRIMARY KEY,
    aplicada_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aw.servicos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(48) NOT NULL UNIQUE,
    nome varchar(100) NOT NULL,
    descricao text,
    ativo boolean NOT NULL DEFAULT true,
    criado_em timestamptz NOT NULL DEFAULT now()
);

INSERT INTO aw.servicos (slug, nome) VALUES
    ('hardware', 'Hardware'),
    ('redes', 'Redes'),
    ('desenvolvimento-web', 'Desenvolvimento Web'),
    ('manutencao', 'Manutenção'),
    ('outro', 'Outro');

INSERT INTO aw.schema_migrations (versao) VALUES ('001_base');

COMMIT;
