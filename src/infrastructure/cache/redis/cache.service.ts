import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { MetricsService } from '../../observability/metrics/metrics.service';
import { REDIS_CLIENT } from './cache.constants';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly metrics: MetricsService,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        this.metrics.recordCacheOperation('miss');
        return null;
      }
      this.metrics.recordCacheOperation('hit');
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `cache get failed key=${key}: ${(error as Error).message}`,
      );
      this.metrics.recordCacheOperation('error');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `cache set failed key=${key}: ${(error as Error).message}`,
      );
      this.metrics.recordCacheOperation('error');
    }
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          deleted += await this.redis.unlink(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(
        `cache invalidatePrefix failed prefix=${prefix}: ${(error as Error).message}`,
      );
      this.metrics.recordCacheOperation('error');
    }
    return deleted;
  }

  async ping(): Promise<boolean> {
    const pong = await this.redis.ping();
    return pong === 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
