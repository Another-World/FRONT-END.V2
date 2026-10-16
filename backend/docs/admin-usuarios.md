# Consulta administrativa de usuários — issue #36

O painel `/admin/usuarios` consulta perfis locais sincronizados após o login no
Supabase. A identidade e o papel `admin` são verificados no backend com o JWT
assinado e o registro atual em `aw.usuarios`; metadados do navegador não
concedem acesso.

## API

- `GET /api/atendimento/usuarios?limite=20&busca=...&ativo=true|false&cursor=...`
  retorna nome, e-mail, empresa, papel, situação, data de cadastro e cursor.
- `GET /api/atendimento/usuarios/:id?limite=20&cursor=...` retorna telefone,
  demais dados do perfil e uma página de solicitações vinculadas ao UUID.
  Visitantes e solicitações de outras contas não são associados por e-mail.
- Ambas exigem `Authorization: Bearer <JWT>` e retornam `Cache-Control: no-store`.
  Paginação tem limite máximo de 50 e usa `(criado_em, id)` para desempatar.
  Os filtros são estritos; busca por nome/e-mail trata `%` e `_` literalmente.

Não há senha nem hash de senha no PostgreSQL da EC2. A tabela de perfis não
registra explicitamente tipo PF/PJ; o painel não deduz esse tipo de um nome de
empresa nem de pedidos antigos. A migração `009_consulta_usuarios.sql` acrescenta
somente o índice da listagem e não amplia grants de `aw_api`.

## Implantação

Aplicar 009 com `psql -v ON_ERROR_STOP=1` após validar backup e release.
Reiniciar a API na nova release, conferir `/api/ready` e que
`/api/atendimento/usuarios` responde 401 sem token. No Nginx, permitir
`/api/atendimento/usuarios` e `/api/atendimento/usuarios/:id` no snippet
atual, preservando redirecionamento HTTP, TLS, CORS e proxy para porta 3001.
O `vercel.json` já inclui `/admin/usuarios`.

Se o endpoint retornar 404 via HTTPS e 401 na porta local, revisar o regex
do Nginx antes de investigar autenticação. Nenhuma credencial nova é necessária.
