CREATE MATERIALIZED VIEW IF NOT EXISTS inside.conversion_daily AS
SELECT
  (created_at AT TIME ZONE 'UTC')::date            AS day,
  channel,
  count(*)                                          AS sent,
  count(*) FILTER (WHERE status_id = 1)             AS valid,
  count(*) FILTER (WHERE status_id = 2)             AS invalid,
  count(*) FILTER (WHERE status_id = 3)             AS incomplete,
  count(*) FILTER (WHERE status_id = 4)             AS pending,
  count(*) FILTER (WHERE status_id = 5)             AS opened,
  count(*) FILTER (WHERE status_id = 6)             AS viewed,
  count(*) FILTER (WHERE status_id <> 2)            AS delivered
FROM inside.channel_events
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS conversion_daily_pk
  ON inside.conversion_daily (day, channel);

CREATE INDEX IF NOT EXISTS conversion_daily_channel_day
  ON inside.conversion_daily (channel, day);

REFRESH MATERIALIZED VIEW inside.conversion_daily;

ANALYZE inside.conversion_daily;
