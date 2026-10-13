# Solicitações da conta: Supabase Auth + PostgreSQL na EC2

## Comportamento

- `POST /api/solicitacoes` continua público quando **não há** Authorization.
- Quando Authorization existe, inclusive vazio/inválido, a API exige um JWT ES256 válido do projeto Supabase. Nunca transforma uma sessão inválida em pedido visitante.
- A propriedade é `req.identidade.id`, derivada do JWT. E-mail de contato, metadata, corpo e query não podem escolher o dono.
- O perfil inicial, o pedido e o evento são gravados na mesma transação. Um perfil desativado recebe 403. A sincronização preserva nome/telefone/empresa editados.
- Reenvio requer a mesma chave, conteúdo e dono. Outra conta ou um visitante recebe 409 sem recuperar o protocolo. A comparação do hash dos pedidos visitantes existentes foi preservada.
- Pedidos antigos com `usuario_id NULL` não são reivindicados por e-mail ou durante o login.
- `GET /api/solicitacoes` exige autenticação e conta ativa. Só retorna protocolo, serviço, status e datas da própria conta, com Cache-Control no-store.
- O frontend espera a sessão, envia o token quando há conta e separa tentativas de envio por identidade. Nenhuma função de demonstração consulta pedidos em localStorage.
- A Área do Cliente mostra carregamento, erro, lista vazia, atualização e carregamento de mais pedidos. Trocar de conta desmonta os dados e cancela requisições anteriores.

## Paginação

GET `/api/solicitacoes?limite=20` retorna:

```json
{
  "solicitacoes": [
    {
      "id": "UUID do protocolo",
      "status": "em_analise",
      "servico": { "slug": "hardware", "nome": "Hardware" },
      "criadaEm": "data ISO",
      "atualizadaEm": "data ISO"
    }
  ],
  "proximoCursor": null
}
```

`limite` aceita 1–50. Para continuar, envie o `proximoCursor` recebido como `cursor`. O cursor preserva os seis dígitos de microssegundos do PostgreSQL e usa UUID como desempate. Não é uma credencial: qualquer cursor continua subordinado ao UUID do JWT. Parâmetros extras, como userId/email, são recusados.

## Migration 005

A auditoria de 13/10/2026 da EC2 confirmou INSERT de usuario_id, SELECT de id/usuario_id/criada_em e SELECT de id/slug dos serviços. A 005 acrescenta somente:

- SELECT de `servico_id`, `status` e `atualizada_em` nas solicitações;
- SELECT de `nome` nos serviços;
- índice de paginação `(usuario_id, criada_em DESC, id DESC)`, substituindo o índice de prefixo da 004.

Não amplia acesso aos campos de contato nem concede UPDATE/DELETE. Requer a 004. Usa uma transação com lock timeout de 5 s; falha no bloqueio interrompe a migration inteira. Inspecionar a saída antes de reiniciar a API.

No banco confirmado da EC2, a partir do diretório com a nova migration:

```bash
sudo -u postgres psql -X -d sistema_postgres -v ON_ERROR_STOP=1 \
  -f migrations/005_solicitacoes_conta.sql
```

O arquivo deve estar legível pelo usuário postgres; não diminuir permissões de diretórios de configuração para isso. Pode-se copiar somente esse SQL para `/tmp` com permissão 0644 e executar dali. Não aplicar as migrations 001–004 novamente.

## Validação automatizada

Na pasta backend:

```bash
npm ci --ignore-scripts
npm test
```

Os testes usam PostgreSQL em memória via PGlite, roles com privilégios mínimos, as migrations reais, o Express real e JWTs ES256 de teste. Não usam contas, senhas, chaves ou banco de produção. Cobrem tokens inválidos/expirados, issuer/audience/role, anônimos Supabase, isolamento, campos proibidos, contas inativas, idempotência entre identidades, rollback e precisão da paginação.

PGlite usa uma única conexão. O teste de envios simultâneos verifica o resultado com transações serializadas; não substitui um teste de contenção com múltiplas conexões PostgreSQL nativas. O fluxo concorrente original com UNIQUE + ON CONFLICT foi preservado.

Na pasta do frontend, executar build e lint dos arquivos alterados. Para produção, instalar dependências do backend com `npm ci --omit=dev --ignore-scripts`; PGlite é somente uma dependência de testes.

## Implantação e rollback

1. Conferir SHA, diretório real de `/opt/another-world-api/current`, ExecStart e caminho do EnvironmentFile do serviço. Não imprimir os valores das variáveis/segredos.
2. Preparar uma release separada com o backend novo e as dependências de produção. Manter a configuração de ambiente usada pelo serviço. Não substituir a release atual ainda.
3. Validar sintaxe, aplicar somente a 005 no banco auditado e confirmar o registro em `aw.schema_migrations`.
4. Guardar o caminho da release anterior, apontar `current` para a nova e reiniciar `another-world-api`.
5. Conferir serviço ativo, `/api/health` 200 e `/api/solicitacoes` sem token 401. Em seguida testar, pelo frontend local via túnel, um pedido autenticado e sua listagem após recarregar.
6. Em falha de aplicação, restaurar o apontamento anterior e reiniciar. A 005 é compatível com a API anterior; não apagar pedidos/perfis nem remover as migrations anteriores como rollback.

Um HTTP 200 em health só comprova o processo HTTP. O teste autenticado de pedidos é necessário para verificar banco e permissões após implantação.

## Validação manual

- Manter túnel PuTTY local 127.0.0.1:3001 → EC2 127.0.0.1:3001.
- Iniciar o frontend com VITE_API_BASE_URL vazio. Entrar numa conta de teste e enviar um pedido identificado como teste. Guardar o protocolo.
- Voltar à Área do Cliente: pedido deve aparecer, inclusive após F5.
- Outra conta não deve ver esse protocolo. Não usar credenciais/tokens reais em logs ou prints de teste.
- Em sessão visitante, o formulário deve enviar normalmente; esse pedido não aparece em nenhuma conta por correspondência de e-mail.
- Falhas/reenvios com a mesma chave não podem duplicar o evento/pedido.

## Pendências separadas

- Publicação no domínio atual da Vercel requer acesso à equipe proprietária, variáveis VITE_SUPABASE/VITE_API_BASE_URL corretas e CORS HTTPS no Nginx.
- Recuperação de senha depende das URLs de retorno autorizadas no Supabase e permanece adiada conforme orientação do usuário.
- Não há painel administrativo, edição de status pelo cliente ou worker de notificações nesta entrega.
- JWTs já emitidos continuam aceitos até expirar após logout no Supabase; o bloqueio por ativo=false é verificado nas operações autenticadas.
