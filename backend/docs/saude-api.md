# Saúde da API e conexão com PostgreSQL

## Endpoints

| Endpoint | Uso | Resposta |
| --- | --- | --- |
| `GET /api/health` | Verificar se o processo responde HTTP | 200 `{"status":"ok"}` |
| `GET /api/ready` | Verificar a conexão com PostgreSQL usando o pool da aplicação | 200 `{"status":"ok","banco":"ok"}` ou 503 `{"status":"indisponivel","banco":"indisponivel"}` |

Os endpoints não exigem JWT. O health mantém o comportamento anterior. A prontidão executa apenas `SELECT 1`: não altera registros e não exige novos grants nem migration. Não verifica o serviço Supabase, migrations ou permissões de operações específicas; os testes autenticados continuam necessários após uma implantação.

## Limites e falhas

- Conexão/espera no pool: limite existente de 5 segundos em `db.js`.
- Consulta de prontidão: `query_timeout` de 2 segundos, tratado pelo driver pg. Em erro, `pool.query` libera e descarta o cliente. Somados, esses limites podem levar aproximadamente 7 segundos; usar timeout HTTP de 10 segundos no monitoramento.
- Requisições simultâneas compartilham a consulta em andamento. Não há cache do resultado; a próxima verificação consulta novamente o banco.
- Quota de 60 requisições por minuto por IP; excesso retorna 429 e não consulta o banco. Polling recomendado: a cada 30 segundos.
- `Cache-Control: no-store` na prontidão, inclusive em falha e excesso de consultas.
- Falha de banco retorna 503 com `Retry-After: 5`, sem detalhes do driver/configuração.
- Erros em conexões ociosas do pool geram um evento JSON sem credenciais ou dados pessoais. O pool remove o cliente com falha e pode abrir novas conexões posteriormente.

## Verificação na EC2 (PuTTY)

```bash
curl -sS --connect-timeout 3 --max-time 10 -i http://127.0.0.1:3001/api/ready
```

Esperado após instalação: HTTP 200 e `{"status":"ok","banco":"ok"}`. Se houver 503, conferir serviço PostgreSQL e logs locais da API; não compartilhar o conteúdo de `api.env`.

Se houver 404, a versão com este endpoint ainda não está implantada. A instalação deve seguir o processo existente de release separada, troca de link e rollback. Não sobrescrever os arquivos da release em execução.

## Testes

`npm --prefix backend test` inclui a consulta real via PGlite com o papel mínimo `aw_api`, falha de conexão usando o driver pg, servidor de protocolo PostgreSQL simulado sem resposta para testar o timeout/descarte, recuperação, consultas simultâneas, rate limit e evento de erro ocioso. Nenhum teste usa banco, tokens ou credenciais de produção. O teste de timeout usa o pg real com servidor simulado, não um PostgreSQL nativo.

## Rollback

Não há migration nesta alteração. Restaurar a release anterior e reiniciar `another-world-api` pelo procedimento já usado. `/api/ready` deixa de existir na versão anterior, portanto ajustar o monitor para não tratar o 404 do rollback como falha nova de banco.
