# k8s — Conversion Pulse

Manifests de topologia de produção: api (Deployment 3→10 réplicas via HPA),
worker (Deployment 1 réplica, mesma imagem, sem HTTP), Postgres (StatefulSet +
PVC), Redis (StatefulSet + PVC, headless), RabbitMQ (StatefulSet + PVC,
headless + painel), Prometheus (Deployment + PVC, scrape via
`kubernetes_sd_configs` usando anotações no pod da api), Grafana (Deployment +
PVC, datasource Prometheus/Loki provisionado), Loki (Deployment + PVC).

## Topologia

```
                          ingress (nginx) / NodePort alt
                                     |
                                cpulse-api  <---- HPA (3-10) / PDB (min 2)
                                /    |    \
                        cpulse-db  cpulse-redis  cpulse-rabbitmq
                                            ^          |
                                            |          v
                                     cpulse-worker (1 réplica, sem Service)

cpulse-prometheus --scrape--> cpulse-api (annotations prometheus.io/*)
cpulse-grafana --datasource--> cpulse-prometheus, cpulse-loki
```

NetworkPolicy restringe ingress de `cpulse-db`, `cpulse-redis` e
`cpulse-rabbitmq` a pods com label `app in (cpulse-api, cpulse-worker)` —
prometheus, grafana e qualquer outro pod não alcançam essas portas.

## Subir num cluster kind local

```bash
kind create cluster --name cpulse

docker build -t cpulse-api:latest .
kind load docker-image cpulse-api:latest --name cpulse

cp k8s/secret.example.yaml k8s/secret.local.yaml
# editar k8s/secret.local.yaml com credenciais reais antes de aplicar
# depois trocar secret.example.yaml por secret.local.yaml no kustomization.yaml local (não versionar o local)

kubectl apply -k k8s/
```

## Ordem de apply (o `kustomization.yaml` já resolve isso, mas se aplicar manifest a manifest a ordem é)

1. `namespace.yaml`
2. `secret.example.yaml` (ou o secret real equivalente)
3. `configmap.yaml`
4. `postgres-statefulset.yaml`
5. `redis-statefulset.yaml`
6. `rabbitmq-statefulset.yaml`
7. `prometheus-deployment.yaml`
8. `grafana-deployment.yaml`
9. `loki-deployment.yaml`
10. `api-deployment.yaml`
11. `api-service.yaml`
12. `worker-deployment.yaml`
13. `hpa.yaml`
14. `pdb.yaml`
15. `network-policy.yaml`
16. `ingress.yaml`

## Verificar

```bash
kubectl -n conversion-pulse get pods -w
kubectl -n conversion-pulse get hpa
kubectl -n conversion-pulse get networkpolicy
kubectl -n conversion-pulse get pdb
```

## Exposição em produção: k3s + NodePort + nginx no host (alternativa ao Ingress)

`ingress.yaml` assume um controller nginx-ingress instalado no cluster e
continua sendo o caminho padrão deste diretório. A máquina alvo real roda
**k3s** e segue outra convenção: app no cluster expõe uma porta via
**NodePort**, um **nginx no host** (fora do cluster) faz reverse proxy para
esse NodePort, e o **TLS é terminado via certbot** no nginx do host — não
dentro do cluster.

Para esse cenário, não aplicar `ingress.yaml`. Em vez disso aplicar os
Services NodePort dedicados (não estão no `kustomization.yaml` por padrão,
para não expor duas rotas ao mesmo tempo em cluster com nginx-ingress
presente):

```bash
kubectl apply -f k8s/api-service-nodeport.yaml
kubectl apply -f k8s/grafana-service-nodeport.yaml
```

NodePorts escolhidos — **30300 (grafana) e 30951 já estão ocupados nessa
máquina por outra app**, por isso:

| serviço | NodePort |
| --- | ---: |
| `cpulse-api-nodeport` | `30380` |
| `cpulse-grafana-nodeport` | `30381` |

Depois, no nginx do host, `proxy_pass` para `http://<node-ip>:30380` (api) e
`http://<node-ip>:30381` (grafana), com certbot cuidando do certificado no
nginx do host.

## Decisões

- Schema do banco (`db/init/01_schema.sql`) não é embarcado nos manifests: `kubectl kustomize` recusa referenciar arquivo fora da raiz do kustomization por segurança, e scripts em `/docker-entrypoint-initdb.d` só rodam com `PGDATA` vazio — em produção real o schema é aplicado por job de migração separado, não por bootstrap do container. Para ambiente kind, aplicar o schema manualmente após o StatefulSet ficar pronto: `kubectl -n conversion-pulse exec -i cpulse-db-0 -- psql -U cpulse -d cpulse < db/init/01_schema.sql`.
- `api-deployment.yaml` usa `readOnlyRootFilesystem: true` com `emptyDir` em `/tmp` — Nest/Fastify não precisam escrever em outro lugar do filesystem do container em runtime.
- `secret.example.yaml` só tem placeholders. Nunca aplicar em produção sem trocar `POSTGRES_PASSWORD`, `DATABASE_URL`, `RABBITMQ_USER`/`RABBITMQ_PASSWORD`/`RABBITMQ_URL` e `GF_SECURITY_ADMIN_PASSWORD`.
- `ingress.yaml` usa host placeholder `cpulse.example.local` — trocar pelo domínio real antes de aplicar em produção.
- `worker-deployment.yaml` não tem Service nem HPA: não expõe porta HTTP (consome fila RabbitMQ, não atende request). Liveness é `exec` checando o processo (`pgrep -f dist/worker.js`) em vez de HTTP — assume base `node:24-alpine` (confirmado no `Dockerfile`), cujo busybox traz `pgrep`. Sem readiness probe: não há dependência de "pronto para receber tráfego" para um consumer.
- `RABBITMQ_URL` e `DATABASE_URL` vêm de `Secret` (contêm credencial embutida na connection string); `REDIS_URL` fica no `ConfigMap` porque o Redis do CONTRACT.md não tem autenticação.
- Prometheus escolhido via **annotations** (`prometheus.io/scrape`, `prometheus.io/port`, `prometheus.io/path` no pod da api) em vez de `ServiceMonitor` — `ServiceMonitor` é CRD do Prometheus Operator, que não está sendo instalado aqui (Prometheus sobe como `Deployment` simples). Annotations funcionam com scrape config `kubernetes_sd_configs` sem depender do operator.
- Prometheus e Grafana e Loki sobem como `Deployment` com 1 réplica + `PersistentVolumeClaim` avulso (não `StatefulSet`) porque não há necessidade de identidade estável nem múltiplas réplicas para esses componentes nesta topologia; `strategy: Recreate` evita dois pods disputando o mesmo PVC `ReadWriteOnce` durante rollout.
- ConfigMap de provisioning do Grafana cria o *provider* de dashboards (`/var/lib/grafana/dashboards`), mas nenhum dashboard JSON é empacotado aqui — isso pertence a `observability/`, fora do escopo deste diretório (`k8s/**` apenas).
- `NetworkPolicy` cobre só `Ingress` (quem pode falar com db/redis/rabbitmq). Não declara `Egress`, então saída de qualquer pod continua liberada por padrão — não é um NetworkPolicy default-deny do namespace inteiro, só granularidade nesses três backends.
- `PodDisruptionBudget` só na api (`minAvailable: 2`, replicas 3-10 via HPA). Worker, redis, rabbitmq, prometheus, grafana e loki rodam 1 réplica cada — PDB não faz sentido ali sem réplicas extras para absorver disrupção.

## Divergências encontradas com `docs/CONTRACT.md`

- CONTRACT.md nomeia os serviços internamente como `db`, `redis`, `rabbitmq`, `prometheus`, `grafana`, `loki` (nomes de serviço do docker-compose). No k8s, os Services usam prefixo `cpulse-` (`cpulse-db`, `cpulse-redis`, `cpulse-rabbitmq`, ...) para bater com a convenção já usada em `postgres-statefulset.yaml`/`api-deployment.yaml` antes desta tarefa. `REDIS_URL`/`RABBITMQ_URL`/datasources do Grafana apontam para os nomes `cpulse-*`, não para os nomes crus do contrato — quem monta o compose usa os nomes do contrato, quem monta o k8s usa `cpulse-*`. Isso é esperado (DNS interno do namespace é isolado do compose), mas registrar aqui porque diverge textualmente do CONTRACT.md.
- CONTRACT.md lista `promtail` como serviço da stack (coleta de log para o Loki). A tarefa desta rodada não pediu manifest de promtail (lista explícita era: worker, redis, rabbitmq, prometheus, grafana, loki) — não foi criado `promtail-daemonset.yaml`. Sem isso, `cpulse-loki` sobe mas não recebe logs de ningém automaticamente dentro do cluster; gap a fechar numa próxima rodada se log centralizado via k8s for necessário (hoje só a app grava stdout, que kubelet já captura via `kubectl logs`, mas isso não chega no Loki sem agente).
- `configmap.yaml` (pré-existente, não alterado nesta tarefa) tem `DB_POOL_MAX: "10"`, enquanto CONTRACT.md especifica `DB_POOL_MAX=20`. Divergência já existia antes desta rodada — sinalizando para quem for revisar, não corrigi por estar fora do escopo pedido (só adicionar variáveis novas).
- CONTRACT.md não define credencial de admin do Grafana nem exige um `Secret` dedicado para RabbitMQ — isso é decisão de implementação k8s (toda credencial em connection string vira `Secret`, nunca `ConfigMap`), não um contrato entre serviços, então não há conflito real, só extensão.
- `postgres-statefulset.yaml` (pré-existente, não tocado nesta rodada) não tem `securityContext` nem em nível de pod nem de container — a imagem `postgres:17-alpine` precisa iniciar como root pra ajustar dono do volume e só então rebaixa via `gosu`; forçar `runAsNonRoot: true` ali quebraria o entrypoint padrão sem trocar a imagem ou o `PGDATA`. Não estava na lista de arquivos pedidos para esta tarefa, então não mexi — mas fica registrado como a única lacuna de `securityContext` não-root no diretório.
