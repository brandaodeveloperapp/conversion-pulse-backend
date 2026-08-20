import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

const THROTTLE_KEY_PREFIX = 'cpulse:throttle:';

interface RateLimitRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttlMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDurationMs = tonumber(ARGV[3])
local blockPttl = redis.call('PTTL', blockKey)
if blockPttl and blockPttl > 0 then
  local current = tonumber(redis.call('GET', hitsKey)) or 0
  local expirePttl = redis.call('PTTL', hitsKey)
  if expirePttl < 0 then
    expirePttl = 0
  end
  return {current, expirePttl, 1, blockPttl}
end
local totalHits = redis.call('INCR', hitsKey)
if totalHits == 1 then
  redis.call('PEXPIRE', hitsKey, ttlMs)
end
local timeToExpire = redis.call('PTTL', hitsKey)
if timeToExpire < 0 then
  timeToExpire = ttlMs
end
if totalHits > limit then
  redis.call('SET', blockKey, 1, 'PX', blockDurationMs)
  return {totalHits, timeToExpire, 1, blockDurationMs}
end
return {totalHits, timeToExpire, 0, 0}
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<RateLimitRecord> {
    const hitsKey = `${THROTTLE_KEY_PREFIX}${key}`;
    const blockKey = `${hitsKey}:blocked`;
    const reply = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      hitsKey,
      blockKey,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];
    const [totalHits, timeToExpireMs, isBlockedFlag, timeToBlockExpireMs] =
      reply;

    return {
      totalHits,
      timeToExpire: Math.max(0, Math.ceil(timeToExpireMs / 1000)),
      isBlocked: isBlockedFlag === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(timeToBlockExpireMs / 1000)),
    };
  }
}
