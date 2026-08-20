import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { SERIES_CACHE } from '../../../domain/port/series-cache.port';
import { REDIS_CLIENT } from './cache.constants';
import { TimeseriesCacheInterceptor } from './cache.interceptor';
import { CacheService } from './cache.service';
import { RedisModule } from './redis.module';
import { RedisSeriesCache } from './redis-series-cache.adapter';
import { RedisThrottlerStorage } from './redis-throttler-storage';

export interface CacheModuleOptions {
  enableHttpInterceptor?: boolean;
  enableRateLimit?: boolean;
}

@Module({})
export class CacheModule {
  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    const enableHttpInterceptor = options.enableHttpInterceptor ?? true;
    const enableRateLimit = options.enableRateLimit ?? true;

    const providers: Provider[] = [
      CacheService,
      { provide: SERIES_CACHE, useClass: RedisSeriesCache },
    ];
    if (enableHttpInterceptor) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: TimeseriesCacheInterceptor,
      });
    }
    if (enableRateLimit) {
      providers.push({ provide: APP_GUARD, useClass: ThrottlerGuard });
    }

    return {
      module: CacheModule,
      global: true,
      imports: enableRateLimit
        ? [RedisModule, buildThrottlerModule()]
        : [RedisModule],
      providers,
      exports: [CacheService, SERIES_CACHE],
    };
  }
}

function buildThrottlerModule(): DynamicModule {
  return ThrottlerModule.forRootAsync({
    imports: [RedisModule],
    inject: [ConfigService, REDIS_CLIENT],
    useFactory: (config: ConfigService, redis: Redis) => ({
      throttlers: [
        {
          ttl:
            Number(config.get<string>('RATE_LIMIT_TTL_SECONDS', '60')) * 1000,
          limit: Number(config.get<string>('RATE_LIMIT_MAX', '120')),
        },
      ],
      storage: new RedisThrottlerStorage(redis),
    }),
  });
}
