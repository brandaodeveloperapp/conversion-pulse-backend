# Arquitetura e decisões

Documento de decisões do Conversion Pulse. O enunciado pede explicitamente o
detalhamento das escolhas de arquitetura, otimização e trade-offs — é isso aqui.

## 1. O problema real

O enunciado descreve o desafio como "otimizar a consulta aos dados, garantindo
tempo de resposta rápido mesmo com grande volume". A leitura ingênua é indexar a
tabela de fatos e torcer. Medimos antes de decidir:

| consulta | tabela fato (9,5M linhas) | rollup | ganho |
| --- | ---: | ---: | ---: |
| janela completa, todos os canais, diário | 2.095 ms | 0,40 ms | **5.264×** |
| 30 dias, um canal | 47,8 ms | 0,05 ms | **1.016×** |

Reproduza com `npm run bench`.

O ponto: mesmo com particionamento e índice ajudando (caso de 30 dias, 47 ms), a
agregação direta é ordens de grandeza mais lenta. E a rota de janela completa —
justamente a tela inicial de qualquer dashboard — custa 2 segundos por request.
Com 20 usuários simultâneos o banco satura.

A observação que destrava tudo: **a resposta é minúscula**. 24 meses × 3 canais
em granularidade diária cabem em 1.362 linhas. Estamos varrendo 9,5 milhões de
linhas para produzir mil. O trabalho pesado é sempre o mesmo e não depende de
quem perguntou — então não pertence ao request.

## 2. Modelo de dados

Três camadas, cada uma com um trabalho:

```
channel_events      9.525.993 linhas   fato bruto, particionado por mês
      ↓ agregação materializada
conversion_daily    1.362 linhas       rollup dia × canal
      ↓ SUM sobre o recorte
resposta da API     ≤ 1.362 pontos     ms, independente do volume
```

### Por que particionar por mês

`created_at` é o eixo de todo filtro da aplicação. Particionar por `RANGE` nesse
campo dá *partition pruning*: um recorte de 30 dias toca 1 ou 2 partições em vez
de 24. A partição `DEFAULT` (`channel_events_overflow`) existe como rede de
segurança — sem ela, um insert fora da janela falha em vez de pousar em algum
lugar recuperável.

### Por que a view materializada e não uma view comum

Uma `VIEW` comum não guarda nada: cada request reexecuta a agregação e voltamos
aos 2 segundos. A `MATERIALIZED VIEW` paga o custo uma vez, no refresh.

O índice `UNIQUE (day, channel)` não é enfeite: sem um índice único a
`MATERIALIZED VIEW` não aceita `REFRESH ... CONCURRENTLY`, e sem `CONCURRENTLY` o
refresh trava leitura na view inteira. Com ele, o refresh roda com a API
servindo normalmente.

### Trade-off assumido

O rollup introduz latência de dados: uma linha inserida agora só aparece no
próximo refresh. Para *evolução temporal de taxa de conversão* isso é irrelevante
— ninguém toma decisão de campanha com granularidade de segundos. Trocamos
frescor que não é usado por três ordens de grandeza de latência que são.

Se um dia frescor importar, o caminho é `TimescaleDB` com *continuous
aggregates*, que atualiza o rollup de forma incremental. O modelo aqui já está no
formato certo para essa migração.

## 3. O campo `created_at`

O enunciado manda criar o campo. O dump não tem nenhuma coluna temporal — só
`id`, `origin` e `response_status_id`. Então a regra de geração é uma decisão de
projeto, e ela precisa ser defensável.

**Primeira tentativa (descartada):** mapa linear do valor do `id` sobre a janela
de 24 meses. Parece óbvio — `id` é sequence, logo é ordem de inserção. Mas o
range de id vai de 61.158.994 a 78.317.939, um span de 17,1 milhões para apenas
9,5 milhões de linhas. **44% do espaço de id são buracos.** Mapeado linearmente,
cada buraco vira um dia sem dado: o email ficava com 504 dos 731 dias, e o
gráfico exibia quedas a zero que são artefato do gerador, não do negócio.

**Regra adotada:** mapear a **posição ordinal** (rank) do `id`, não seu valor,
através da inversa de uma CDF de sazonalidade. Isso preserva o que é real e
descarta o que é artefato:

- ordem temporal relativa é mantida — `id` menor continua vindo antes;
- os buracos do espaço de id somem, porque rank é denso por construção;
- volume por dia segue uma curva com dia de semana, sazonalidade anual e leve
  crescimento, em vez de ser artificialmente plano;
- hora do dia sai de uma CDF com pico comercial, semeada por hash do `id`.

Tudo determinístico: zero `random()`. O mesmo dump gera sempre exatamente as
mesmas datas, em qualquer máquina. Reprodutibilidade importa porque os números de
benchmark deste documento precisam ser verificáveis por quem avalia.

Cobertura resultante: email 721/731 dias, mobile 602/731, wpp 39. Os vãos que
sobraram são ids contíguos em lote — comportamento real de disparo em campanha,
preservado de propósito.

Janela e granularidade são configuráveis por env (`WINDOW_START`,
`WINDOW_MONTHS`); o padrão é 2024-01-01 + 24 meses.

## 4. Achados do dataset que viraram decisão

Três coisas que só aparecem lendo o dump, e cada uma quebraria a rota em
silêncio:

**`origin` com caixa inconsistente.** O dump traz `MOBILE` em maiúsculas contra
`email` e `wpp` em minúsculas. Um `GROUP BY origin` ingênuo rachava o canal em
duas séries. Normalizado para minúsculas na carga.

**Status 3 (Incompleto) não existe nos dados.** A lista do enunciado tem seis
status; o dump usa cinco. A coluna existe no rollup e vale zero. Não é bug —
é o motivo de a API sempre devolver o denominador junto da taxa.

**wpp tem 1.952 linhas contra 6,6M de email.** Três ordens de grandeza de
diferença. Uma taxa de conversão sobre 2 envios num dia oscila violentamente e
não significa nada. Por isso `sent`, `converted` e `delivered` viajam em toda
resposta: **um gráfico que mostra só a taxa mente sobre o wpp.** Quem consome
decide se plota, se agrega em granularidade maior ou se esconde abaixo de um
mínimo de amostra — mas com a informação na mão.

Distribuição completa:

| status | rótulo | linhas |
| ---: | --- | ---: |
| 4 | Pendente | 9.313.560 |
| 5 | Aberto | 117.367 |
| 2 | Inválido | 55.444 |
| 1 | Válido | 28.464 |
| 6 | Visualizou | 11.158 |
| 3 | Incompleto | 0 |

## 5. Carga dos dados

O dump são 298 MB de `INSERT` com 10 linhas cada — cerca de 950 mil statements.
Executar isso direto leva dezenas de minutos: cada statement paga parse, plan e
uma ida ao WAL.

`scripts/transform-dump.mjs` faz streaming do `.sql` e emite CSV, que entra por
`COPY`. Números reais nesta máquina:

| etapa | tempo |
| --- | ---: |
| transform 9,5M linhas para CSV | 12,9 s |
| `COPY` para a tabela particionada | 5,5 s |
| índices + rollup | ~3 s |

Ordem importa: índices são criados **depois** do `COPY`. Índice existente durante
a carga força manutenção de árvore a cada linha inserida.

## 6. Escolhas de stack

**NestJS.** O enunciado libera Node ou Go. Go seria mais rápido no runtime, mas
o gargalo desta aplicação é o banco, não a serialização — e ficou provado: a
query custa 1 a 9 ms e o roundtrip HTTP inteiro, 3 a 15 ms. Trocar o runtime
otimizaria a fração que já não é o problema. NestJS entrega injeção de
dependência, validação declarativa, OpenAPI gerado do código e estrutura modular
— tudo o que uma avaliação de arquitetura pede.

**Fastify em vez de Express.** Adapter oficial do Nest, throughput maior, custo
zero de adoção.

**`pg` puro, sem ORM.** As consultas desta aplicação são agregações analíticas.
ORM aqui só adiciona uma camada que atrapalha o controle sobre o SQL, que é
exatamente o objeto do desafio. Toda query é parametrizada.

**Colunas dinâmicas com segurança.** O filtro `conversionStatuses` monta a
expressão de soma a partir de um `Record` fixo de id para nome de coluna. Ids
válidos só podem virar nomes daquele mapa; qualquer outro é descartado antes de
tocar em SQL. Injeção não tem por onde entrar, e os valores em si viajam sempre
como parâmetro.

## 7. Formato da resposta

Toda resposta carrega numerador e denominador, nunca só a taxa:

```json
{
  "meta":   { "from": "...", "to": "...", "granularity": "day",
              "channels": [...], "conversionStatuses": [1],
              "queryMs": 9, "source": "conversion_daily" },
  "totals": { "sent": 9525993, "converted": 28464, "conversionRate": 0.002988 },
  "series": [ { "period": "2024-01-01", "channel": "email",
                "sent": 7441, "converted": 0, "delivered": 7432,
                "conversionRate": 0, "openRate": 0.012783 } ]
}
```

`queryMs` e `source` são deliberados: expõem em produção qual camada serviu o
request e quanto ela custou, sem precisar abrir o banco.

Divisão por zero devolve `null`, não `0`. Um dia sem envio **não teve taxa zero
por cent**; ele não tem taxa. `0` seria uma afirmação falsa que o gráfico
desenharia como queda real.
