# Envio de decisões e propostas por e-mail — issue #35

## Situação e ativação

O envio fica **desligado por padrão** (`EMAILS_ENABLED` ausente ou diferente de
`true`). Nesse estado, decisões administrativas não são enfileiradas, a API de
envio de proposta devolve 503 e a interface não oferece o botão automático.
As decisões tomadas antes da ativação não são enviadas retroativamente.

Usa Amazon SES v2, com autenticação do SDK pelo papel IAM da EC2, sem chaves
AWS no repositório, no frontend ou no arquivo de ambiente. Variáveis do
`/etc/another-world-api/api.env`: `AWS_REGION`, `EMAIL_FROM` (identidade
verificada na mesma região) e, **somente após validar remetente, destinatário,
permissões e sandbox**, `EMAILS_ENABLED=true`. O papel precisa de permissão
`ses:SendEmail` restrita à identidade verificada. Não configure a opção
enquanto a conta não puder enviar ao destinatário real. Um endereço individual
verificado permite testes sem domínio; para operação estável, configurar um
domínio próprio com autenticação DKIM/DMARC e acompanhamento de bounces.

Os testes automatizados substituem o SES por cliente falso; não demonstram
entrega real nem garantem caixa de entrada. `MessageId` confirma aceitação
pelo SES, não recebimento/leitura. Sem configuração de bounces e reclamações,
não há confirmação de entrega. Efetuar um teste deliberado para endereço
verificado e depois conferir SES, caixa de entrada e cabeçalhos de autenticação.

## Dados e segurança

A migration `008_emails.sql` amplia a fila `aw.comunicacoes` e acrescenta a
transição `aguardando_envio` à proposta. Não modifica as tabelas `public.*`.
O e-mail da decisão usa o contato do pedido persistido e a versão do status;
o e-mail da proposta usa o contato congelado na proposta. O navegador não
escolhe destinatário. A fila contém o corpo de texto e somente a referência à
proposta; o PDF protegido é gerado no backend imediatamente antes de enviar
e anexado via SES. Não há link público de download.

Um índice único em `evento_chave` impede enfileiramento duplicado da mesma
decisão/mesma proposta. Mudar o status novamente gera outra versão e pode
gerar outra comunicação. O envio manual existente continua disponível para
rascunhos e não dispara e-mail. Proposta enfileirada congela o conteúdo, não
aceita confirmação manual e não permite outra proposta aberta para o pedido.

O worker verifica `status='pendente'`, reserva a linha com `FOR UPDATE SKIP
LOCKED`, marca `processando` e então chama o SES fora da transação. Após
receber `MessageId`, grava `enviada` na comunicação e, para proposta, altera
o status para `enviada` e registra evento na mesma transação. Os estados da
proposta e do e-mail são consultados separadamente. `EMAILS_ENABLED=true`
inicia o worker no processo da API, até dez itens por rodada, a cada 30 s.

Se o provedor falha ou a rede expira após iniciar uma tentativa, o resultado
é **incerto**: comunicação `falhou/resultado_incerto`, proposta continua
`aguardando_envio`. Reinício durante processamento deixa `processando`.
Nenhum desses estados é reenviado automaticamente; o SES não garante
deduplicação pela chave local. Para reconciliar, confira o identificador da
comunicação e logs `email_nao_confirmado` ou
`email_aceito_sem_confirmacao_local`, e consulte o SES antes de decidir o
próximo passo. Não altere diretamente os status nem clique novamente para
enviar: uma mensagem pode ter sido aceita pelo SES apesar da falha local.
Propostas nessa situação exigem acompanhamento técnico para destravar.

## Implantação segura

1. Verificar `git`/testes/build e aplicar a migration **somente uma vez**, como
   `postgres`, após backup restaurado e confirmação de `007_orcamentos`.
2. Preparar nova release e instalar dependências com
   `npm ci --omit=dev --ignore-scripts`. Antes de ativar, conferir que
   `EMAILS_ENABLED` não está definido como `true` em `api.env`.
3. Ativar API, conferir `/api/health=200`, `/api/ready=200`, rota de proposta
   sem autenticação `401`, rota `/email` sem autenticação `401`. Nginx já
   encaminha `/api/atendimento/...` com método `POST` no CORS; não exige nova
   porta nem regra. Publicar frontend depois da API.
4. Configurar identidade SES, permissões IAM mínimas, saída do sandbox quando
   houver destinatários não verificados, monitoramento e teste de entrega.
   Ligar `EMAILS_ENABLED=true` por último e reiniciar a API, após conferir que
   não há itens antigos inesperados na fila.

Consulta de operação na EC2, como `postgres`, sem exibir nomes/e-mails:

```sql
SELECT tipo,status,count(*) FROM aw.comunicacoes
WHERE canal='email' AND evento_chave IS NOT NULL
GROUP BY tipo,status ORDER BY tipo,status;
```

Ao voltar para uma release antiga, desligue `EMAILS_ENABLED`, mantenha a
migration e os registros. Releases anteriores desconhecem `aguardando_envio`;
não faça rollback de uma proposta nesse estado sem reconciliar o SES.
