\timing on

\echo '=== A) agregacao direta na tabela fato (9,5M linhas) ==='
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON)
SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
       channel,
       count(*) AS sent,
       count(*) FILTER (WHERE status_id = 1) AS valid
FROM inside.channel_events
GROUP BY 1, 2
ORDER BY 1, 2;

\echo '=== B) mesma resposta lendo o rollup ==='
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON)
SELECT day, channel, sent, valid
FROM inside.conversion_daily
ORDER BY day, channel;

\echo '=== C) fato, recorte de 30 dias + canal (partition pruning) ==='
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON)
SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
       count(*) AS sent,
       count(*) FILTER (WHERE status_id = 1) AS valid
FROM inside.channel_events
WHERE channel = 'email'
  AND created_at >= '2025-06-01' AND created_at < '2025-07-01'
GROUP BY 1 ORDER BY 1;

\echo '=== D) rollup, mesmo recorte ==='
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON)
SELECT day, sent, valid
FROM inside.conversion_daily
WHERE channel = 'email'
  AND day >= '2025-06-01' AND day < '2025-07-01'
ORDER BY day;
