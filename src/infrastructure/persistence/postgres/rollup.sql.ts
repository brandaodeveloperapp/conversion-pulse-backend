export const ROLLUP_VIEW = 'inside.conversion_daily';
export const FACT_TABLE = 'inside.channel_events';

export const BOUNDS_SQL = `SELECT min(day)::text AS min_day, max(day)::text AS max_day FROM ${ROLLUP_VIEW}`;

export const CHANNELS_SQL = `
  SELECT channel,
         sum(sent)::bigint AS sent,
         min(day)::text    AS first_day,
         max(day)::text    AS last_day
  FROM ${ROLLUP_VIEW}
  GROUP BY channel
  ORDER BY sum(sent) DESC`;

export const ROLLUP_ROWS_SQL = `SELECT count(*)::text AS rows FROM ${ROLLUP_VIEW}`;

export const EVENTS_BY_CHANNEL_SQL = `SELECT channel, sum(sent)::text AS total FROM ${ROLLUP_VIEW} GROUP BY channel`;

export function refreshSql(concurrently: boolean): string {
  return `REFRESH MATERIALIZED VIEW ${concurrently ? 'CONCURRENTLY ' : ''}${ROLLUP_VIEW}`;
}

/** As colunas somadas vêm de um mapa fixo de id para nome de coluna no domínio,
 * nunca da entrada crua — por isso a interpolação aqui é segura. Os valores
 * seguem como parâmetro. */
export function timeseriesSql(convertedColumns: readonly string[]): string {
  const converted = convertedColumns.length
    ? convertedColumns.map((column) => `sum(${column})`).join(' + ')
    : '0';

  return `
    SELECT to_char(date_trunc($3, day::timestamp), 'YYYY-MM-DD') AS period,
           channel,
           sum(sent)::bigint      AS sent,
           (${converted})::bigint AS converted,
           sum(delivered)::bigint AS delivered,
           sum(opened)::bigint    AS opened,
           sum(viewed)::bigint    AS viewed
    FROM ${ROLLUP_VIEW}
    WHERE day >= $1::date AND day <= $2::date
      AND ($4::text[] IS NULL OR channel = ANY($4))
    GROUP BY 1, 2
    ORDER BY 1, 2`;
}
