import { RollupRefreshMessage } from '../src/domain/port/rollup-queue.port';

type RedisValue = string;

/**
 * In-memory stand-in for the ioredis client.
 *
 * Honours COUNT during SCAN so the cursor loop in CacheService is actually
 * exercised, and implements EVAL well enough for the rate limiter to count
 * hits instead of silently failing open.
 */
export class FakeRedis {
  private readonly store = new Map<string, RedisValue>();
  private readonly counters = new Map<string, number>();

  get(key: string): Promise<RedisValue | null> {
    return Promise.resolve(this.store.get(key) ?? null);
  }

  set(key: string, value: RedisValue): Promise<'OK'> {
    this.store.set(key, value);
    return Promise.resolve('OK');
  }

  scan(
    cursor: string,
    _match: string,
    pattern: string,
    _count: string,
    size: number,
  ): Promise<[string, string[]]> {
    const prefix = pattern.replace(/\*$/, '');
    const matching = [...this.store.keys()].filter((key) =>
      key.startsWith(prefix),
    );
    const start = Number(cursor);
    const page = matching.slice(start, start + size);
    const next = start + size >= matching.length ? '0' : String(start + size);
    return Promise.resolve([next, page]);
  }

  unlink(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  eval(
    _script: string,
    _numKeys: number,
    hitsKey: string,
    _blockKey: string,
    ttlMs: number,
    limit: number,
    blockDurationMs: number,
  ): Promise<[number, number, number, number]> {
    const totalHits = (this.counters.get(hitsKey) ?? 0) + 1;
    this.counters.set(hitsKey, totalHits);
    return Promise.resolve(
      totalHits > limit
        ? [totalHits, ttlMs, 1, blockDurationMs]
        : [totalHits, ttlMs, 0, 0],
    );
  }

  ping(): Promise<'PONG'> {
    return Promise.resolve('PONG');
  }

  quit(): Promise<'OK'> {
    this.store.clear();
    this.counters.clear();
    return Promise.resolve('OK');
  }
}

export class FakeRabbitConnection {
  readonly published: RollupRefreshMessage[] = [];

  getChannel(): null {
    return null;
  }

  onModuleInit(): Promise<void> {
    return Promise.resolve();
  }

  onModuleDestroy(): Promise<void> {
    return Promise.resolve();
  }
}
