# Contrato de integração

Interfaces fixas entre os componentes. Compose, Kubernetes, CI e código da
aplicação são escritos contra este documento — quem mudar algo aqui quebra os
outros.

## Serviços e portas

| serviço | host interno | porta | exposto no host (dev) |
| --- | --- | ---: | --- |
| api | `api` | 3000 | `3000` |
| worker | `worker` | 9101 | não expõe (só `/metrics`) |
| db | `db` | 5432 | `5432` |
| redis | `redis` | 6379 | não expõe |
| rabbitmq | `rabbitmq` | 5672 / 15672 | `15672` (painel) |
| prometheus | `prometheus` | 9090 | `9090` |
| grafana | `grafana` | 3000 | `3001` |
| loki | `loki` | 3100 | não expõe |
| promtail | `promtail` | — | não expõe |

Em produção nada além do nginx escuta em interface pública. A API roda em k3s e
o nginx alcança o NodePort `30983` pelo próprio host; `/metrics` é bloqueado na
borda.

## Variáveis de ambiente

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://USER:PASS@db:5432/DB
DB_POOL_MAX=20
DB_STATEMENT_TIMEOUT_MS=15000

REDIS_URL=redis://redis:6379
CACHE_TTL_SECONDS=60
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_MAX=120

WORKER_METRICS_PORT=9101

RABBITMQ_URL=amqp://cpulse:cpulse@rabbitmq:5672
ROLLUP_EXCHANGE=cpulse.rollup
ROLLUP_QUEUE=cpulse.rollup.refresh
ROLLUP_ROUTING_KEY=rollup.refresh
ROLLUP_CRON=0 */15 * * * *

LOG_LEVEL=info
METRICS_ENABLED=true
OTEL_SERVICE_NAME=conversion-pulse-api
```

O worker sobrescreve `OTEL_SERVICE_NAME=conversion-pulse-worker`. Sem isso os
dois processos escrevem logs sob o mesmo nome de serviço e ficam
indistinguíveis no Loki.

## Endpoints HTTP

| rota | versionada | descrição |
| --- | --- | --- |
| `GET /health` | não | liveness. 200 ok, 503 degradado |
| `GET /health/ready` | não | readiness: db, redis e rabbitmq |
| `GET /metrics` | não | exposição Prometheus, `text/plain` |
| `GET /api/v1/conversion/timeseries` | v1 | série temporal; aceita `page`/`pageSize` (série completa sem `pageSize`) |
| `GET /api/v1/conversion/channels` | v1 | canais disponíveis |
| `GET /docs` | não | Swagger UI |

## Métricas Prometheus

Prefixo `cpulse_`. Labels sempre em snake_case.

| métrica | tipo | labels |
| --- | --- | --- |
| `cpulse_http_request_duration_seconds` | histogram | `method`, `route`, `status_code` |
| `cpulse_http_requests_total` | counter | `method`, `route`, `status_code` |
| `cpulse_db_query_duration_seconds` | histogram | `operation` |
| `cpulse_cache_operations_total` | counter | `result` (`hit`/`miss`/`error`) |
| `cpulse_rollup_refresh_total` | counter | `result` (`success`/`failure`) |
| `cpulse_rollup_refresh_duration_seconds` | histogram | — |
| `cpulse_rollup_rows` | gauge | — |
| `cpulse_events_total` | gauge | `channel` |

Métricas default do `prom-client` (processo, heap, event loop) ficam ligadas.

As métricas vivem no processo que as produz: `cpulse_rollup_refresh_*` só
existe no worker, porque é ele quem refresca. Por isso o worker expõe
`/metrics` em `9101` e o Prometheus raspa os dois alvos — sem isso o refresh do
rollup seria invisível.

**Gauges globais não se somam entre réplicas.** `cpulse_events_total` e
`cpulse_rollup_rows` descrevem o banco, não o processo: com três réplicas da
API, `sum by (channel) (cpulse_events_total)` devolve o triplo do valor real.
Use `max by (channel) (...)`. Os counters (`cpulse_http_*`,
`cpulse_cache_operations_total`) são por processo e aí `sum` é o correto.

| métrica | onde é populada |
| --- | --- |
| `cpulse_http_*` | api |
| `cpulse_db_query_duration_seconds` | api (adapter do repositório) |
| `cpulse_cache_operations_total` | api |
| `cpulse_events_total` | api (ao listar canais) |
| `cpulse_rollup_rows` | api (health) e worker (pós-refresh) |
| `cpulse_rollup_refresh_*` | worker |

## Mensageria

Exchange `cpulse.rollup`, tipo `topic`, durável. Fila
`cpulse.rollup.refresh`, durável, ligada por `rollup.refresh`.

Mensagem publicada pela API (cron) e consumida pelo worker:

```json
{ "requestedAt": "2026-08-20T03:00:00.000Z", "reason": "scheduled", "concurrently": true }
```

`reason` aceita `scheduled` ou `manual`. O worker executa
`REFRESH MATERIALIZED VIEW CONCURRENTLY inside.conversion_daily`, emite as
métricas de refresh e faz `ack`. Em falha, `nack` sem requeue — a próxima
execução do cron cobre.

## Cache

Chave: `cpulse:ts:` + sha1 do querystring normalizado (parâmetros ordenados).
TTL `CACHE_TTL_SECONDS`. Invalidação por prefixo `cpulse:ts:*` após cada refresh
bem-sucedido do rollup — quem apaga é o worker.

Resposta traz o header `X-Cache: HIT` ou `MISS`.

## Imagem de container

Uma única imagem serve API e worker; muda só o comando.

```
api    -> node dist/main.js   (HTTP 3000)
worker -> node dist/worker.js (HTTP 9101, só /metrics)
```

Sem registry. A imagem é construída no próprio servidor a partir do código que
o `git` levou até lá, tagueada como `conversion-pulse:local`, e a anterior é
removida no mesmo deploy. Nada de artefato de build sai da máquina.
