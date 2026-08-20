# Conversion Pulse

API de evolução temporal da taxa de conversão por canal sobre **9.525.993 envios**.

Desafio Tech Lead — Ilumeo Data Science. Enunciado original em
[`docs/CHALLENGE.md`](docs/CHALLENGE.md).

**No ar:** https://conversion-pulse.brandaodeveloper.com.br
· [Swagger](https://conversion-pulse.brandaodeveloper.com.br/docs)
· [série mensal](https://conversion-pulse.brandaodeveloper.com.br/api/v1/conversion/timeseries?granularity=month)
· [health](https://conversion-pulse.brandaodeveloper.com.br/health)

## O resultado em uma tabela

| consulta | agregando o fato (9,5M linhas) | servindo do rollup | ganho |
| --- | ---: | ---: | ---: |
| janela completa, todos os canais, diário | 2.251 ms | **0,21 ms** | ~10.700× |
| 30 dias, um canal | 46,1 ms | **0,03 ms** | ~1.500× |

Mediana de três execuções de `EXPLAIN ANALYZE` com a stack de nove containers
no ar. O dígito exato varia com o cache do Postgres — o que não varia é a ordem
de grandeza. Ponta a ponta, HTTP incluído: **15 ms** no primeiro request,
**3 ms** servido do cache. Sessenta requests concorrentes na rota mais pesada:
**147 ms no total, 2,5 ms/req**, todos 200.

Reproduza: `npm run bench`.

## Subir em um comando

```bash
docker compose up -d db      # Postgres 17 + schema
npm run db:load              # dump -> CSV -> COPY -> indices -> rollup
docker compose up -d --build # API
```

O dump (`case_tech_lead.sql`, 298 MB) não está versionado. Baixe do
[Drive do enunciado](https://drive.google.com/drive/folders/1r7sn8MuBoBJRGB_DBtiJQsa9ydTKrvXx)
e coloque em `data/`.

Pronto: API em `http://localhost:3000`, Swagger em `http://localhost:3000/docs`.

## A rota

```
GET /api/v1/conversion/timeseries
```

| parâmetro | valores | padrão |
| --- | --- | --- |
| `from` / `to` | data ISO | intervalo completo dos dados |
| `granularity` | `day` `week` `month` | `day` |
| `channels` | `email` `mobile` `wpp`, separados por vírgula | todos |
| `conversionStatuses` | ids de 1 a 6, separados por vírgula | `1` (Válido) |
| `pageSize` | 1 a 1000; omitido devolve a série inteira | — |
| `page` | página 1-based da série (só com `pageSize`) | `1` |

```bash
curl 'https://conversion-pulse.brandaodeveloper.com.br/api/v1/conversion/timeseries?granularity=month&channels=email,mobile'
```

```json
{
  "meta": {
    "from": "2024-01-01", "to": "2025-12-31", "granularity": "month",
    "channels": ["email", "mobile"], "conversionStatuses": [1],
    "queryMs": 2, "source": "conversion_daily"
  },
  "totals": { "sent": 9524041, "converted": 28455, "conversionRate": 0.002988 },
  "series": [
    { "period": "2024-01-01", "channel": "email", "sent": 202511,
      "converted": 166, "delivered": 201138, "opened": 6507, "viewed": 0,
      "conversionRate": 0.00082, "openRate": 0.032351 }
  ]
}
```

`conversionStatuses` redefine o que conta como conversão sem tocar em SQL. O
padrão `1` dá 0,2988% global; `1,5` (Válido ou Aberto) dá 1,53%.

Outras rotas: `GET /api/v1/conversion/channels` (canais, volume e intervalo,
útil para popular filtros) e `GET /health` (liveness + readiness do banco).

## Por que rollup, e não índice

A leitura ingênua do enunciado é indexar a tabela de fatos. Medimos antes: mesmo
com particionamento e índice ajudando, a agregação direta custa 2 segundos na
janela completa — que é justamente a tela inicial de qualquer dashboard.

A observação que resolve: **a resposta é minúscula**. 24 meses × 3 canais em
granularidade diária cabem em 1.362 linhas. Varrer 9,5 milhões de linhas para
produzir mil, a cada request, é trabalho repetido que não depende de quem
perguntou — então não pertence ao request.

```
channel_events      9.525.993 linhas   fato bruto, particionado por mês
      ↓ agregação materializada
conversion_daily    1.362 linhas       rollup dia × canal
      ↓ SUM sobre o recorte
resposta da API     ≤ 1.362 pontos     ms, independente do volume
```

Trade-off assumido: o rollup introduz latência de dados. Para evolução temporal
de taxa de conversão isso é irrelevante — ninguém decide campanha com
granularidade de segundos. Trocamos frescor que não é usado por três ordens de
grandeza de latência que são.

O raciocínio completo — particionamento, `REFRESH CONCURRENTLY`, escolha de
stack, geração do `created_at` — está em
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Três achados do dataset que viraram decisão

Coisas que só aparecem lendo o dump, e que quebrariam a rota em silêncio:

**`origin` com caixa inconsistente.** O dump traz `MOBILE` em maiúsculas contra
`email` e `wpp` em minúsculas. Um `GROUP BY origin` ingênuo racha o canal em duas
séries. Normalizado na carga.

**Status 3 (Incompleto) não existe nos dados.** O enunciado lista seis status; o
dump usa cinco.

**wpp tem 1.952 linhas contra 6,6M de email.** Três ordens de grandeza de
diferença — uma taxa sobre 2 envios num dia não significa nada. Por isso `sent`,
`converted` e `delivered` viajam em toda resposta: **um gráfico que mostra só a
taxa mente sobre o wpp.** E divisão por zero devolve `null`, não `0` — um dia sem
envio não teve taxa zero, ele não tem taxa.

## O campo `created_at`

O enunciado manda criar o campo; o dump não tem nenhuma coluna temporal. A regra
de geração é decisão de projeto:

Mapeamos a **posição ordinal** (rank) do `id` — não seu valor — através da
inversa de uma CDF de sazonalidade. O mapa linear pelo valor foi testado e
descartado: o range de id tem 44% de buracos, e cada buraco virava um dia sem
dado, produzindo quedas a zero que são artefato do gerador, não do negócio.

Determinístico, sem `random()`: o mesmo dump gera sempre as mesmas datas, em
qualquer máquina — os números de benchmark acima são verificáveis.

## Stack

Node 24 · NestJS 11 · Fastify · TypeScript strict · Postgres 17 · `pg` sem ORM ·
Docker Compose · manifests Kubernetes em [`infra/k8s/`](infra/k8s/).

Go seria mais rápido no runtime, mas o gargalo é o banco: a query custa 1 a 9 ms
e o roundtrip HTTP inteiro, 3 a 32 ms. Trocar o runtime otimizaria a fração que
já não é o problema.

## Testes

```bash
npm test          # 55 unit
npm run test:e2e  # 5 e2e, sem infra real
```

Os e2e sobem o `AppModule` de verdade e trocam apenas os três adaptadores de
saída — Postgres, Redis e RabbitMQ — por fakes em memória. É o retorno concreto
de portas e adapters: o teste troca o adapter, não a regra. Rodam em CI sem
nenhum container, em menos de um segundo.

## Estrutura

Hexagonal (ports & adapters). A regra de dependência aponta sempre para
dentro: `domain` não importa nada de framework, `application` conhece só as
portas, e todo detalhe de infraestrutura é substituível sem tocar na regra.

```
src/domain/         entidades, cálculo de taxa e as portas (interfaces)
src/application/    casos de uso; orquestra portas, sem saber quem as implementa
src/infrastructure/ adapters: postgres, redis, rabbitmq, métricas, logs
src/presentation/   HTTP: controllers, DTOs de request/response, interceptors
src/shared/         configuração tipada
db/init/            schema, particionamento (roda no boot do container)
db/post-load/       indices e rollup (aplicados depois do COPY, de propósito)
scripts/            transform do dump, carga, benchmark
deploy/nginx/       vhost de produção, igual ao que roda no host
observability/      Prometheus, Loki, Promtail e dashboard (stack local)
infra/k8s/          base autocontida + overlay de produção (kustomize)
docs/               arquitetura e enunciado original
```

O que essa fronteira compra, na prática: trocar o rollup por outra fonte, ou o
Redis por um cache local, é escrever um adapter novo — nenhum arquivo de
`domain/` ou `application/` muda.

## Deploy

Sem registry. A imagem é construída, salva como tarball, enviada por SSH e
importada direto no containerd do k3s — o artefato nunca sai das duas máquinas
que precisam dele.

Merge em `main` → CI verde → **CD sobe sozinho**. O mesmo caminho roda à mão
quando preciso:

```bash
./deploy.sh
```

`docker save | gzip` → `scp` → `k3s ctr images import` → `kubectl apply -k` →
smoke test. Testa primeiro o NodePort pelo próprio host e só depois a URL
pública: se falhar no primeiro, o problema é o k3s; se passar no primeiro e
falhar no segundo, é o nginx. Qualquer falha dispara `rollout undo` — nunca
fica uma versão quebrada no ar.

O runner autentica com uma **chave ed25519 dedicada a este projeto**, apagada
do runner ao fim de todo job. Revogar é tirar uma linha do `authorized_keys`,
sem tocar nas chaves dos outros projetos do mesmo host.

A tag é sempre o SHA curto do commit, nunca `latest`: uma tag mutável torna
impossível saber o que está rodando. O deploy recusa árvore suja.

`infra/k8s/base/` é autocontida — inclui Ingress, ServiceMonitor e a própria
stack de observabilidade, então aplica em qualquer cluster completo
(kind, minikube, EKS). O overlay `production/` remove exatamente o que a
máquina real não tem ou já tem: sem ingress-controller, o tráfego entra por
nginx:443 → NodePort 30983; e Prometheus, Grafana e Loki já rodam num namespace
`observability` compartilhado, então subir os nossos duplicaria custo e
dividiria os painéis em dois.

## Scripts

| comando | o que faz |
| --- | --- |
| `npm run db:up` | sobe só o Postgres |
| `npm run db:load` | pipeline completo de carga |
| `npm run db:refresh` | `REFRESH MATERIALIZED VIEW CONCURRENTLY` |
| `npm run bench` | benchmark fato vs rollup |
| `npm run stack:up` | sobe tudo |
