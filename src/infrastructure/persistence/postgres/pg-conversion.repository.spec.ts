import { PgConversionRepository } from './pg-conversion.repository';
import type { PostgresConnection } from './postgres-connection.service';
import type { MetricsService } from '../../observability/metrics/metrics.service';

function repoWith(rowsFor: (sql: string) => unknown[]) {
  const dbCalls: string[] = [];
  const db = {
    query: jest.fn((sql: string) => {
      dbCalls.push(sql);
      return Promise.resolve(rowsFor(sql));
    }),
  } as unknown as PostgresConnection;
  const observed: { operation: string }[] = [];
  const events: { channel: string; count: number }[] = [];
  const metrics = {
    observeDbQuery: (operation: string) => observed.push({ operation }),
    setEventsTotal: (channel: string, count: number) =>
      events.push({ channel, count }),
  } as unknown as MetricsService;
  return {
    repo: new PgConversionRepository(db, metrics),
    dbCalls,
    observed,
    events,
  };
}

describe('PgConversionRepository', () => {
  it('maps count rows to typed numbers and reports queryMs', async () => {
    const { repo, observed } = repoWith(() => [
      {
        period: '2024-01-01',
        channel: 'email',
        sent: '202511',
        converted: '166',
        delivered: '201138',
        opened: '6507',
        viewed: '0',
      },
    ]);

    const result = await repo.findTimeseries({
      range: { from: '2024-01-01', to: '2024-12-31' },
      granularity: 'month',
      channels: ['email'],
      conversionStatuses: [1],
    });

    expect(result.counts[0]).toMatchObject({
      channel: 'email',
      sent: 202511,
      converted: 166,
      delivered: 201138,
    });
    expect(typeof result.counts[0].sent).toBe('number');
    expect(result.queryMs).toBeGreaterThanOrEqual(0);
    expect(observed).toContainEqual({ operation: 'timeseries' });
  });

  it('falls back to the epoch when the fact table is empty', async () => {
    const { repo } = repoWith(() => [{ min_day: null, max_day: null }]);
    const bounds = await repo.findBounds();
    expect(bounds).toEqual({ from: '1970-01-01', to: '1970-01-01' });
  });

  it('emits an events gauge per channel while listing channels', async () => {
    const { repo, events } = repoWith(() => [
      {
        channel: 'email',
        sent: '6608389',
        first_day: '2024-01-01',
        last_day: '2025-12-31',
      },
      {
        channel: 'wpp',
        sent: '1952',
        first_day: '2024-01-07',
        last_day: '2024-09-11',
      },
    ]);

    const channels = await repo.listChannels();

    expect(channels).toHaveLength(2);
    expect(channels[0]).toMatchObject({ channel: 'email', sent: 6608389 });
    expect(events).toContainEqual({ channel: 'email', count: 6608389 });
    expect(events).toContainEqual({ channel: 'wpp', count: 1952 });
  });
});
