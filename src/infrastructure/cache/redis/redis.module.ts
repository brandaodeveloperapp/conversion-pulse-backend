import { Global, Logger, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

const logger = new Logger('RedisModule');

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

/**
 * Owns the single Redis connection shared by the cache and the rate limiter.
 *
 * Kept apart from CacheModule so the throttler can inject the same client
 * instead of opening a second connection, and so tests have one seam to
 * override.
 */
@Global()
@Module({
  providers: [redisClientProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
