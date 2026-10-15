# Operação da Another World na EC2

Estado conferido em 14/10/2026. Este documento registra a instalação atual e os procedimentos validados; revisar os caminhos quando mudar a infraestrutura.

## Estado da entrega

| Item | Evidência |
| --- | --- |
| Autenticação e perfil | JWT Supabase validado pelo backend; perfil carregado e editado pelo frontend local |
| Solicitações da conta | Pedido autenticado criado e listado; perfil e pedido continuam visíveis após reabrir o frontend |
| Autorização e idempotência | 25 testes aprovados no desenvolvimento e no Windows, incluindo falhas de banco, isolamento e permissões |
| API implantada | Commit `e28bdf914f29e2fec73b0e0c0b54040d45bc3168` |
| Saúde | `/api/health` 200; `/api/ready` 200 com banco conectado; listagem sem token 401 |
| HTTPS e CORS | `/api/ready` verificado externamente com 200 e origem do frontend permitida |
| Restauração | Backup restaurado em banco temporário: cinco migrations, um perfil e quatro pedidos |
| Frontend público | Publicação da branch e variáveis Vercel ainda pendentes; etapa adiada pelo responsável |
| Recuperação de senha | Adiada pelo usuário; não foi validado o fluxo de recuperação em produção |
| Atendimento | Painel administrativo e envio automático por e-mail/WhatsApp não implementados nesta entrega |

Os testes de driver pg usam um servidor de protocolo simulado para timeout e conexão local inacessível para indisponibilidade. Os testes de SQL/autorização usam PGlite. A restauração descrita aqui foi executada no PostgreSQL nativo da EC2.

## Infraestrutura confirmada

| Componente | Configuração |
| --- | --- |
| Serviço systemd | `another-world-api` |
| Usuário/grupo do processo | `aw-api` / `aw-api` |
| Comando | `/usr/bin/node src/server.js` |
| Diretório de trabalho | `/opt/another-world-api/current` |
| Release atual | `/opt/another-world-api/releases/e28bdf9` |
| Release anterior | `/opt/another-world-api/releases/3f083d2` |
| Ambiente protegido | `/etc/another-world-api/api.env` |
| API interna | `http://127.0.0.1:3001` |
| API HTTPS | `https://100.61.230.173` |
| PostgreSQL e ferramentas | 15.19 |
| Banco | `sistema_postgres` |
| Papel de conexão | `aw_api` (diferente do usuário Linux `aw-api`) |
| Schema da aplicação | `aw` |
| Branch com a entrega | `biel-solicitacoes-autenticadas` |

Não registrar conteúdo de `api.env`, JWTs, senhas ou chaves privadas em terminal compartilhado, logs ou commits. O backend verifica JWT com chaves públicas; não precisa da chave Supabase `service_role`.

## Desenvolvimento local no Windows

1. Abrir a conexão PuTTY com a EC2. Em Connection → SSH → Tunnels, manter o túnel Local/Auto de `127.0.0.1:3001` para `127.0.0.1:3001`.
2. Manter a janela PuTTY conectada.
3. No Git Bash, dentro de `~/Documents/FRONT-END.V2`, usar a branch `biel-solicitacoes-autenticadas`.
4. Manter `VITE_API_BASE_URL=` vazio no `.env.local` do frontend para usar o proxy do Vite.
5. Executar:

```bash
npm --prefix another-world-v2 run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir `http://127.0.0.1:5173/area-cliente`. Manter o Git Bash do Vite aberto e usar outra janela para comandos de Git. O túnel é necessário somente para o desenvolvimento local; a publicação usa HTTPS diretamente.

## Verificações rápidas na EC2

Executar no PuTTY:

```bash
sudo systemctl is-active another-world-api
sudo readlink -f /opt/another-world-api/current
curl -sS --noproxy '*' --connect-timeout 3 --max-time 10 -i http://127.0.0.1:3001/api/ready
curl -sS --noproxy '*' --connect-timeout 3 --max-time 10 -i http://127.0.0.1:3001/api/solicitacoes
```

Esperados: `active`, release correta, prontidão 200 e listagem sem JWT 401. O readiness verifica `SELECT 1`, não todas as permissões nem disponibilidade do Supabase. Consultar `saude-api.md` para limites e significado dos resultados.

Para testar o Nginx HTTPS pela própria EC2, mantendo a validação do certificado:

```bash
curl -sS --noproxy '*' --connect-timeout 3 --max-time 10 \
  --resolve 100.61.230.173:443:127.0.0.1 \
  -H 'Origin: https://another-world-sigma.vercel.app' \
  -i https://100.61.230.173/api/ready
```

## Nginx

O servidor HTTP/HTTPS está em `/etc/nginx/conf.d/hub-api.conf` e inclui `/etc/nginx/snippets/another-world-api.conf`. A regra da Another World deve conter:

```nginx
location ~ ^/api/(health|ready|solicitacoes|perfil)/?$ {
    # Demais diretivas atuais de HTTPS, CORS, limites e proxy são preservadas.
}
```

Este trecho mostra apenas o padrão da rota: não substitui o arquivo completo. O destino dessas rotas é `http://127.0.0.1:3001`. O destino da rota geral `/` é outra API na porta 3000.

Após salvar uma cópia em `/var/backups/another-world/nginx`, validar com `sudo nginx -t` e recarregar com `sudo systemctl reload nginx`. A recarga inicia novos workers; repetir a verificação HTTPS com intervalo de um segundo antes de considerar falha e restaurar a configuração anterior. Não desativar a validação TLS para fazer o teste passar.

A inclusão de `ready` foi validada em 14/10/2026. A cópia anterior dessa alteração é `/var/backups/another-world/nginx/api-20261014T173314Z.conf`; ela não inclui `ready`.

## Implantação e rollback

1. Confirmar SHA completo publicado, release apontada por `current` e estado do serviço.
2. Baixar o backend do SHA imutável para uma pasta de preparo; executar `npm ci --omit=dev --ignore-scripts`.
3. Criar release separada em `/opt/another-world-api/releases`. Usar proprietário `root:aw-api` e permissões `u=rwX,g=rX,o=`.
4. Validar `node --check` e importação de `src/app.js` dentro de um shell executado como `aw-api`. Esse usuário tem acesso à release; o usuário `ec2-user` pode não conseguir expandir seus globs.
5. Aplicar somente migrations novas, após conferir estado e compatibilidade. A alteração `e28bdf9` não exigiu migration.
6. Trocar `current` por link simbólico com `mv -Tf`, reiniciar o serviço e aguardar inicialização, verificando saúde 200, prontidão 200 e listagem sem token 401.
7. Em falha, restaurar o apontamento anterior e reiniciar. Conferir a saída antes de continuar.

No rollback para `3f083d2`, `/api/ready` deixa de existir. O 404 desse endpoint é esperado nessa versão; ajustar o monitor. As migrations 004/005 permanecem compatíveis e não devem ser apagadas como rollback.

## Backup validado

Snapshot de 14/10/2026 às 17:45:56 UTC (14:45:56 em São Paulo):

```text
/var/backups/another-world/postgres/20261014_174556_2697
```

- `sistema_postgres.dump`: banco completo em formato custom do pg_dump.
- `globals-sem-senhas.sql`: definições globais de roles/tablespaces, sem senhas dos roles.
- `SHA256SUMS`: hashes dos dois arquivos, verificados com resultado OK.
- `restore.log`: log protegido da restauração.
- `VALIDADO.txt`: confirmação da restauração e remoção do banco temporário.

O teste restaurou em `aw_restore_20261014_174556_2697`, com limite de conexão zero e CONNECT revogado de PUBLIC. Foram conferidas migrations e permissões, além das contagens sob `SET ROLE aw_api`. O banco de teste foi removido; o banco da API permaneceu em uso e a prontidão respondeu OK ao final.

A pasta de cada snapshot é `postgres:postgres`, modo 0700. O processo usa umask 077; arquivos são privados. Estes backups contêm dados reais e não devem ser anexados ao chat ou adicionados ao Git.

Para conferir novamente os hashes:

```bash
sudo -u postgres /bin/bash -c '
set -e
cd /var/backups/another-world/postgres/20261014_174556_2697
sha256sum -c SHA256SUMS
'
```

O teste usou os roles já existentes no mesmo cluster. O arquivo de globais foi gerado e teve integridade conferida; não foi aplicado em um servidor novo. Em recuperação em outra máquina, revisar/restaurar roles necessários e definir suas senhas por canal seguro, pois foram omitidas desse arquivo. Não aplicar o SQL de globais indiscriminadamente no cluster atual.

O backup atual está no mesmo disco da EC2. Agendamento, retenção e cópia externa ainda não foram configurados; definir esses itens antes de depender do ambiente para dados críticos de produção.

## Repetir backup e teste de restauração

Executar no PuTTY conectado à EC2. O comando cria um snapshot novo, restaura em banco temporário restrito, valida migrations/permissões e remove somente esse banco temporário após sucesso. Em falha, interrompe e mantém o snapshot e, se criado, o banco temporário para inspeção. O log detalhado fica na pasta privada do snapshot.

```bash
(
set -e
cd /tmp

aw_stamp="$(date -u +%Y%m%d_%H%M%S)_$$"
aw_base="/var/backups/another-world/postgres"
aw_dir="$aw_base/$aw_stamp"
aw_teste="aw_restore_$aw_stamp"

sudo install -d -o root -g postgres -m 0750 "$aw_base"
sudo test ! -e "$aw_dir"
sudo install -d -o postgres -g postgres -m 0700 "$aw_dir"

aw_fim() {
  aw_saida=$?
  trap - EXIT
  if [ "$aw_saida" != "0" ]; then
    echo "Processo interrompido. Envie esta saída."
    echo "Pasta do backup: $aw_dir"
    echo "Banco temporário, caso criado: $aw_teste"
    echo "Log protegido de restauração: $aw_dir/restore.log"
  fi
  exit "$aw_saida"
}
trap aw_fim EXIT

sudo -u postgres /bin/bash -c '
set -e
umask 077
cd "$1"
pg_dump --dbname=sistema_postgres --format=custom \
  --lock-wait-timeout=5s --file=sistema_postgres.dump
pg_dumpall --globals-only --no-role-passwords --file=globals-sem-senhas.sql
pg_restore --list sistema_postgres.dump >/dev/null
sha256sum sistema_postgres.dump globals-sem-senhas.sql >SHA256SUMS
' aw-backup "$aw_dir"

sudo -u postgres psql -X -d postgres \
  -v ON_ERROR_STOP=1 -v aw_db="$aw_teste" <<'SQL'
CREATE DATABASE :"aw_db" WITH TEMPLATE template0 CONNECTION LIMIT 0;
REVOKE CONNECT ON DATABASE :"aw_db" FROM PUBLIC;
SQL

sudo -u postgres /bin/bash -c '
set -e
umask 077
pg_restore --dbname="$1" --single-transaction --exit-on-error \
  "$2/sistema_postgres.dump" >"$2/restore.log" 2>&1
' aw-restore "$aw_teste" "$aw_dir"

sudo -u postgres psql -X -d "$aw_teste" \
  -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT current_database() AS banco_de_teste;
DO $$
BEGIN
  IF (SELECT count(*) FROM aw.schema_migrations
      WHERE versao IN ('004_usuarios', '005_solicitacoes_conta')) <> 2 THEN
    RAISE EXCEPTION 'Migrações esperadas não foram restauradas.';
  END IF;
  IF NOT has_column_privilege('aw_api', 'aw.solicitacoes_orcamento', 'status', 'SELECT')
     OR NOT has_column_privilege('aw_api', 'aw.servicos', 'nome', 'SELECT')
     OR has_column_privilege('aw_api', 'aw.usuarios', 'papel', 'UPDATE')
     OR has_column_privilege('aw_api', 'aw.usuarios', 'ativo', 'UPDATE')
     OR has_table_privilege('aw_api', 'aw.usuarios', 'DELETE')
     OR has_table_privilege('aw_api', 'aw.usuarios', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Permissões restauradas diferem das esperadas.';
  END IF;
END;
$$;
SELECT versao FROM aw.schema_migrations ORDER BY versao;
SET ROLE aw_api;
SELECT count(id) AS perfis_restaurados FROM aw.usuarios;
SELECT count(id) AS pedidos_restaurados FROM aw.solicitacoes_orcamento;
RESET ROLE;
SQL

sudo -u postgres dropdb "$aw_teste"

sudo -u postgres /bin/bash -c '
set -e
umask 077
cd "$1"
sha256sum -c SHA256SUMS
printf "Restauração e permissões validadas; banco temporário removido.\n" >VALIDADO.txt
' aw-validacao "$aw_dir"

curl -fsS --noproxy '*' --connect-timeout 3 --max-time 10 \
  http://127.0.0.1:3001/api/ready
echo
echo "Backup validado: $aw_dir"
trap - EXIT
)
```

## Publicação do frontend: pendente

A equipe Vercel que hospeda o projeto é identificada pelo slug `mateus-projects-0eb99825`; projeto `another-world`. No painel atual, os ambientes aparecem em Project Settings → Environments. Confirmar as variáveis do ambiente selecionado na tela real, pois o menu pode mudar.

| Variável | Valor |
| --- | --- |
| `VITE_API_BASE_URL` | `https://100.61.230.173` |
| `VITE_SUPABASE_URL` | `https://tiomofklixzulyexlqpl.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública completa `sb_publishable_...` correspondente ao projeto; usar a configuração local já validada |

Configurar Production; configurar Preview quando for testar a branch antes da integração. Não integrar à branch de produção antes dessa confirmação. Mudanças de variáveis só entram no build/deploy seguinte. Após publicação, testar login/perfil, pedido, listagem e F5 no domínio público.

O Nginx permite a origem `https://another-world-sigma.vercel.app`. Uma URL Preview diferente não foi adicionada ao CORS nesta entrega; seus testes de API pelo navegador dependem de uma origem autorizada. Manter o frontend local com proxy Vite para os testes atuais.

## Referências técnicas

- [Saúde da API](saude-api.md)
- [Solicitações da conta](solicitacoes-conta.md)
- [Perfis e Supabase](perfis-supabase.md)
- [Recarga do Nginx](https://nginx.org/en/docs/control.html)
- [pg_dump PostgreSQL 15](https://www.postgresql.org/docs/15/app-pgdump.html)
- [pg_restore PostgreSQL 15](https://www.postgresql.org/docs/15/app-pgrestore.html)
