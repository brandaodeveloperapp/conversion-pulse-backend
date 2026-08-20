import {
  RefreshRollupUseCase,
  RequestRollupRefreshUseCase,
} from './refresh-rollup.use-case';
import { SERIES_CACHE_PREFIX } from '../cache-key';
import type { RollupRefresherPort } from '../../domain/port/rollup-refresher.port';
import type { SeriesCachePort } from '../../domain/port/series-cache.port';
import type {
  RollupQueuePort,
  RollupRefreshMessage,
} from '../../domain/port/rollup-queue.port';

class FakeRefresher implements RollupRefresherPort {
  refreshCalls: boolean[] = [];
  rows = 1362;
  refresh(concurrently: boolean): Promise<void> {
    this.refreshCalls.push(concurrently);
    return Promise.resolve();
  }
  stats() {
    return Promise.resolve({
      rollupRows: this.rows,
      eventsByChannel: new Map<string, number>(),
    });
  }
}

class FakeCache implements SeriesCachePort {
  invalidated: string[] = [];
  get<T>(): Promise<T | null> {
    return Promise.resolve(null);
  }
  set(): Promise<void> {
    return Promise.resolve();
  }
  invalidatePrefix(prefix: string): Promise<void> {
    this.invalidated.push(prefix);
    return Promise.resolve();
  }
}

class FakeQueue implements RollupQueuePort {
  published: RollupRefreshMessage[] = [];
  publishRefresh(message: RollupRefreshMessage): Promise<void> {
    this.published.push(message);
    return Promise.resolve();
  }
}

describe('RefreshRollupUseCase', () => {
  it('refreshes, then invalidates the series cache by prefix', async () => {
    const refresher = new FakeRefresher();
    const cache = new FakeCache();
    const useCase = new RefreshRollupUseCase(refresher, cache);

    const outcome = await useCase.execute(true);

    expect(refresher.refreshCalls).toEqual([true]);
    expect(cache.invalidated).toEqual([SERIES_CACHE_PREFIX]);
    expect(outcome.rollupRows).toBe(1362);
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('passes the concurrently flag through to the refresher', async () => {
    const refresher = new FakeRefresher();
    const useCase = new RefreshRollupUseCase(refresher, new FakeCache());

    await useCase.execute(false);

    expect(refresher.refreshCalls).toEqual([false]);
  });
});

describe('RequestRollupRefreshUseCase', () => {
  it('publishes a well-formed refresh message', async () => {
    const queue = new FakeQueue();
    const useCase = new RequestRollupRefreshUseCase(queue);

    await useCase.execute('manual', '2026-08-20T03:00:00.000Z');

    expect(queue.published).toEqual([
      {
        reason: 'manual',
        requestedAt: '2026-08-20T03:00:00.000Z',
        concurrently: true,
      },
    ]);
  });

  it('honours an explicit concurrently=false', async () => {
    const queue = new FakeQueue();
    const useCase = new RequestRollupRefreshUseCase(queue);

    await useCase.execute('scheduled', '2026-08-20T03:00:00.000Z', false);

    expect(queue.published[0].concurrently).toBe(false);
  });
});
