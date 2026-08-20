import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';
import { TimeseriesCacheInterceptor } from './cache.interceptor';
import { CacheService } from './cache.service';
import { RedisThrottlerStorage } from './redis-throttler-storage';

export interface CacheModuleOptions {
  enableHttpInterceptor?: boolean;
  enableRateLimit?: boolean;
}

const logger = new Logger('CacheModule');

function createRedisClient(url: string): Redis {
  const client = new Redis(url, { maxRetriesPerRequest: 2 });
  client.on('error', (error: Error) => {
    logger.warn(`redis connection error: ${error.message}`);
  });
  return client;
}

const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis =>
    createRedisClient(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
    ),
};

@Module({})
export class CacheModule {
  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    const enableHttpInterceptor = options.enableHttpInterceptor ?? true;
    const enableRateLimit = options.enableRateLimit ?? true;

    const providers: Provider[] = [redisClientProvider, CacheService];
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
      imports: enableRateLimit ? [buildThrottlerModule()] : [],
      providers,
      exports: [CacheService, REDIS_CLIENT],
    };
  }
}

function buildThrottlerModule(): DynamicModule {
  return ThrottlerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      throttlers: [
        {
          ttl:
            Number(config.get<string>('RATE_LIMIT_TTL_SECONDS', '60')) * 1000,
          limit: Number(config.get<string>('RATE_LIMIT_MAX', '120')),
        },
      ],
      storage: new RedisThrottlerStorage(
        createRedisClient(
          config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        ),
      ),
    }),
  });
}
