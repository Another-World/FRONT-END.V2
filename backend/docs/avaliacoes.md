# Avaliações — issue #37

Documento atualizado em 16/10/2026 para registrar as regras aprovadas, a
implementação local e os passos que ainda precisam ser publicados.

## Explicação simples

A avaliação passa por quatro partes:

1. O cliente envia uma nota para uma solicitação concluída.
2. A API confere a identidade pelo login e grava a avaliação como `pendente`.
3. Um administrador abre `/admin/avaliacoes` e decide publicar ou ocultar.
4. O banco guarda quem tomou a decisão, quando e por qual motivo.

O fluxo técnico continua sendo:

`Frontend -> HTTPS/443 -> Nginx -> API Node.js/3001 -> PostgreSQL/5432`

O processo antigo na porta 3000 não participa desta funcionalidade.

## Regras aprovadas

1. Somente o dono de uma solicitação concluída pode avaliá-la.
2. Cada solicitação aceita uma única avaliação.
3. A nota é um número inteiro de 1 a 5.
4. Toda avaliação nova começa como `pendente`.
5. O administrador pode publicar ou ocultar; uma avaliação oculta pode ser
   publicada novamente.
6. Cada mudança guarda administrador, data, estado anterior, estado novo e
   motivo.
7. O administrador não pode editar a nota, a observação ou a sugestão do
   cliente.
8. `public.tb_avaliacoes` é uma estrutura antiga e deve ser preservada.
9. A nova funcionalidade usa o schema `aw` e migrations versionadas.
10. A autoria vem do JWT validado; o formulário não escolhe `usuario_id`.

## O que foi implementado no repositório

### Banco de dados

A migration `010_avaliacoes.sql` cria:

- `aw.avaliacoes`, ligada por UUID a `aw.usuarios` e a
  `aw.solicitacoes_orcamento`;
- `aw.avaliacoes_eventos`, que guarda o histórico de moderação;
- restrições de nota, status, tamanho dos textos e uma avaliação por solicitação;
- um gatilho que torna autoria, vínculo, nota e textos imutáveis;
- controle de versão para duas telas não sobrescreverem a mesma decisão;
- permissões mínimas para o papel `aw_api`, sem permissão de exclusão.

A migration exige `009_consulta_usuarios` e não lê, altera ou remove
`public.tb_avaliacoes`.

### API

| Método e rota | Quem usa | Função |
| --- | --- | --- |
| `POST /api/avaliacoes` | Cliente autenticado | Envia a avaliação de uma solicitação concluída |
| `GET /api/avaliacoes/solicitacoes/:id` | Cliente autenticado | Consulta a própria avaliação ou informa que ainda não existe |
| `GET /api/atendimento/avaliacoes` | Administrador | Lista, filtra e pagina avaliações |
| `GET /api/atendimento/avaliacoes/:id` | Administrador | Mostra conteúdo e histórico |
| `PATCH /api/atendimento/avaliacoes/:id/status` | Administrador | Publica ou oculta com confirmação e motivo |

A listagem aceita `status`, `nota`, `limite` e `cursor`. Quantidade e média são
calculadas no banco sobre todas as avaliações, e não somente sobre a página
visível. Quando não há notas, a média é `null`.

A API valida novamente, dentro da transação, se a conta continua ativa e se o
administrador ainda possui esse papel. Um envio repetido com o mesmo conteúdo é
idempotente; uma segunda avaliação diferente para a mesma solicitação recebe
conflito e não altera a primeira.

### Painel administrativo

A rota `/admin/avaliacoes` agora possui uma página própria. Ela mostra:

- indicadores reais de quantidade e média;
- filtros de status e nota;
- paginação;
- cliente, serviço, data, nota, observações e sugestões;
- publicação e ocultação com motivo e confirmação;
- histórico das decisões;
- estados separados para carregamento, erro, banco vazio e filtro sem resultado.

Nenhum dado demonstrativo é usado. A nota e os textos aparecem somente para
leitura.

### Formulário do cliente

Uma solicitação concluída mostra o formulário de avaliação na Área do Cliente.
O cliente escolhe de 1 a 5 estrelas e pode escrever observações e sugestões.
Antes do envio, a tela confirma que o conteúdo não poderá ser editado. Depois do
envio, o formulário é substituído por um resumo somente de leitura com nota,
textos, data e status. Contas administrativas não recebem esse formulário.

Ao recarregar a página, o frontend consulta
`GET /api/avaliacoes/solicitacoes/:id`. A API só responde para o cliente dono da
solicitação e não expõe histórico ou motivos internos de moderação.

## Validação feita localmente

- Os 6 testes específicos de avaliações passaram antes da última proteção de
  papel do cliente: banco/permissões, autoria, solicitação concluída, validações,
  duplicidade/idempotência, indicadores, filtros, autorização administrativa,
  moderação, histórico, concorrência, imutabilidade e rollback da auditoria.
- Depois dessa proteção, a sintaxe do módulo e o teste da migration/permissões
  passaram. O teste de rejeição do papel administrador também foi acrescentado.
- O frontend compilou para produção com sucesso.
- A nova página passou no ESLint. A verificação completa ainda aponta dois erros
  anteriores e fora desta issue, em `BotaoAjuda.jsx` e `GooeyNav.jsx`.
- A repetição da suíte completa do backend foi bloqueada no ambiente isolado do
  Windows ao abrir servidores HTTP locais (`EACCES`). Antes desta alteração, os
  79 testes existentes passaram; a falha atual ocorreu antes das requisições e
  não indicou regressão funcional.

Esses testes usam bancos temporários e tokens de teste. Eles não validam a EC2.

## Publicação segura na EC2

Esta etapa ainda não foi executada. A ordem recomendada é:

1. Confirmar que a release atual possui as migrations 001 a 008 e fazer o
   backup operacional já usado pelo projeto.
2. Copiar apenas `010_avaliacoes.sql` para um caminho legível pelo PostgreSQL.
3. Aplicar a migration com erro obrigatório:

   ```bash
   sudo -u postgres psql -X -d sistema_postgres -v ON_ERROR_STOP=1 -f /caminho/010_avaliacoes.sql
   ```

4. Confirmar o registro sem mostrar avaliações ou dados pessoais:

   ```bash
   sudo -u postgres psql -X -d sistema_postgres -P pager=off -c \
     "SELECT versao FROM aw.schema_migrations WHERE versao = '010_avaliacoes';"
   ```

5. Publicar e reiniciar a API da porta 3001. Conferir `/api/health` e
   `/api/ready` antes e depois.
6. Incluir `avaliacoes` na regra do Nginx que encaminha a API oficial. O padrão
   deve abranger as rotas atuais, por exemplo:

   ```nginx
   location ~ ^/api/(health|ready|solicitacoes|perfil|avaliacoes|atendimento(/.*)?)/?$ {
       # Preservar CORS, HTTPS e proxy_pass para 127.0.0.1:3001 já existentes.
   }
   ```

   Esse trecho é apenas o padrão da rota. Não deve substituir o arquivo inteiro.
   Fazer uma cópia, executar `sudo nginx -t` e somente então recarregar o Nginx.
7. Publicar o frontend.
8. Homologar com duas contas de teste: um cliente com solicitação concluída e
   um administrador. Conferir criação, atualização após F5, filtros, publicação,
   ocultação, republicação, histórico e bloqueio de cliente no painel.

Não apagar tabelas para fazer rollback. A API anterior ignora as tabelas novas;
por isso o retorno seguro é apontar para a release anterior e preservar a
migration e os registros até a causa ser revisada.

## Dependências e limite desta entrega

A issue #37 depende funcionalmente do login/JWT, dos usuários em `aw.usuarios`,
das solicitações e do painel administrativo. Esses componentes já existem no
projeto. Não depende das issues de dashboard, usuários, PDF ou e-mail.

O formulário do cliente foi incluído como complemento da entrega administrativa,
permitindo demonstrar o fluxo completo sem inserir dados manualmente no banco.

## Verificação da issue #33

A issue #33 continua aberta no GitHub, mas o PR #42 foi integrado à `main`.
Listagem, busca por nome/protocolo, filtros, detalhes, decisões confirmadas,
reabertura, histórico, controle de versão e autorização administrativa estão no
código. Os 79 testes anteriores e o build do frontend passaram na revisão.

Para encerrar a #33, falta confirmar a versão publicada na EC2 e homologar com
um pedido de teste: busca, filtro, decisão/cancelamento, persistência após F5 e
bloqueio de uma conta cliente. As issues #34 (proposta/PDF) e #35 (e-mails) são
entregas separadas e não bloqueiam o escopo da #33.

