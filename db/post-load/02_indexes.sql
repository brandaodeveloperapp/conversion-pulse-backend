ALTER TABLE inside.channel_events
  DROP CONSTRAINT IF EXISTS channel_events_status_fk;

ALTER TABLE inside.channel_events
  ADD CONSTRAINT channel_events_status_fk
  FOREIGN KEY (status_id) REFERENCES inside.response_status (id);

CREATE INDEX IF NOT EXISTS channel_events_created_at_brin
  ON inside.channel_events USING brin (created_at) WITH (pages_per_range = 32);

CREATE INDEX IF NOT EXISTS channel_events_channel_created_at
  ON inside.channel_events (channel, created_at);

ANALYZE inside.channel_events;
