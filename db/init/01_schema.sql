CREATE SCHEMA IF NOT EXISTS inside;

CREATE TABLE inside.response_status (
  id          smallint PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  label       text NOT NULL,
  is_delivered boolean NOT NULL,
  is_converted boolean NOT NULL
);

INSERT INTO inside.response_status (id, code, label, is_delivered, is_converted) VALUES
  (1, 'valid',      'Válido',     true,  true),
  (2, 'invalid',    'Inválido',   false, false),
  (3, 'incomplete', 'Incompleto', true,  false),
  (4, 'pending',    'Pendente',   true,  false),
  (5, 'opened',     'Aberto',     true,  false),
  (6, 'viewed',     'Visualizou', true,  false);

CREATE TABLE inside.channel_events (
  id         bigint      NOT NULL,
  channel    text        NOT NULL,
  status_id  smallint    NOT NULL,
  created_at timestamptz NOT NULL
) PARTITION BY RANGE (created_at);

DO $$
DECLARE
  window_start date := date '2024-01-01';
  months int := 24;
  i int;
  p_from date;
  p_to date;
BEGIN
  FOR i IN 0..months - 1 LOOP
    p_from := window_start + (i || ' month')::interval;
    p_to   := window_start + ((i + 1) || ' month')::interval;
    EXECUTE format(
      'CREATE TABLE inside.channel_events_%s PARTITION OF inside.channel_events FOR VALUES FROM (%L) TO (%L)',
      to_char(p_from, 'YYYY_MM'), p_from, p_to
    );
  END LOOP;
END $$;

CREATE TABLE inside.channel_events_overflow
  PARTITION OF inside.channel_events DEFAULT;
