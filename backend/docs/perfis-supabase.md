# Perfis: Supabase Auth + PostgreSQL na EC2

## Configuração

- Aplicar a migração `004_usuarios` antes de usar as rotas de perfil.
- Instalar `jose` no backend.
- Definir `SUPABASE_URL=https://tiomofklixzulyexlqpl.supabase.co` no ambiente do backend, junto das variáveis PG já existentes.
- No frontend local, usar `VITE_API_BASE_URL=` para encaminhar `/api` ao backend local pelo proxy do Vite. Manter as variáveis VITE_SUPABASE já configuradas.
- Em produção, encaminhar `/api/perfil` ao backend na porta 3001. O CORS deverá permitir Authorization e PATCH, além dos cabeçalhos/métodos existentes. Fazer essa configuração após os testes locais.

## Rotas

Todas exigem `Authorization: Bearer <access_token>` e respondem com `Cache-Control: no-store`.

| Método | Caminho | Comportamento |
| --- | --- | --- |
| POST | /api/perfil | Cria o perfil pelo UUID autenticado ou sincroniza seu e-mail. Preserva nome/telefone/empresa já editados. Repetir não duplica o perfil. |
| GET | /api/perfil | Lê somente o perfil do UUID autenticado. Não cria perfil. |
| PATCH | /api/perfil | Edita nome, telefone e empresa do UUID autenticado. Exige os três campos; telefone/empresa aceitam null. |

Resposta de sucesso: `{ "perfil": { "id", "nome", "email", "telefone", "empresa", "papel", "criadoEm", "atualizadoEm" } }`.

PATCH recebe `{ "nome": "Biel", "telefone": "11999998888", "empresa": null }`.
Campos extras são recusados. Erros: 400 dados inválidos, 401 sessão inválida/ausente, 403 perfil desativado, 404 perfil ainda não criado, 429 limite de requisições, 503 verificação da sessão indisponível.

## Identidade e autorização

- A assinatura ES256 é verificada com as chaves públicas do projeto; validar também issuer, audience, exp, iat e UUID. Não apenas decodificar o token.
- A API recusa identidades anônimas e tokens com role diferente de authenticated.
- Nome do metadata é uma sugestão inicial; permissões vêm do PostgreSQL. Não aceitar papel/ativo/ID/e-mail do formulário.
- `auth.users` permanece no Supabase. `aw.usuarios.id` usa o mesmo UUID; não existe FK entre os dois servidores.
- Senhas e chaves service_role não são necessárias na EC2 para esta validação.
- JWTs válidos podem continuar sendo aceitos até expirar após logout/revogação no Supabase. Esta etapa não consulta o Supabase a cada chamada para revogação imediata. O bloqueio local por ativo=false é verificado em cada operação de perfil.
- Excluir/recriar uma conta não transfere o perfil antigo: a nova identidade terá outro UUID, mesmo reutilizando e-mail.

## Comportamento atual da interface

Entrar na Área do Cliente sincroniza o perfil. O cadastro/confirmar e-mail no Supabase, sozinho, ainda não cria uma linha na EC2. A Área do Cliente permite editar nome, telefone e empresa e confirma a gravação pela API.

Esta entrega não vincula novas solicitações ao UUID, não consulta pedidos reais e não envia mensagens. Pedidos anônimos anteriores não serão associados automaticamente por e-mail. A integração dessas solicitações será uma etapa separada.

## Verificação manual local

1. Manter o túnel SSH do PostgreSQL aberto, iniciar backend e frontend locais.
2. GET /api/perfil sem token deve retornar 401; /api/health continua retornando status ok.
3. Entrar na conta e abrir a Área do Cliente: cria/sincroniza um perfil.
4. Editar os campos, salvar e recarregar: os dados devem persistir.
5. Sair e entrar com outra conta: deve aparecer outro perfil.
6. Conferir no Adminer/PostgreSQL a linha em aw.usuarios; não compartilhar credenciais nem access_token.
