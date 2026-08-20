import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';
import type { SeriesCachePort } from '../../../domain/port/series-cache.port';

const DEFAULT_TTL_SECONDS = 60;

@Injectable()
export class RedisSeriesCache implements SeriesCachePort {
  constructor(private readonly cache: CacheService) {}

  get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  set<T>(
    key: string,
    value: T,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    return this.cache.set(key, value, ttlSeconds);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    await this.cache.invalidatePrefix(prefix);
  }
}
