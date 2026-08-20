import { RedisThrottlerStorage } from './redis-throttler-storage';

describe('RedisThrottlerStorage', () => {
  it('maps a non-blocked reply into a ThrottlerStorageRecord', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([3, 45000, 0, 0]) };
    const storage = new RedisThrottlerStorage(redis as unknown as never);

    const record = await storage.increment('ip:1.2.3.4', 60000, 120, 60000);

    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 45,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('maps a blocked reply into a ThrottlerStorageRecord', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([121, 45000, 1, 60000]) };
    const storage = new RedisThrottlerStorage(redis as unknown as never);

    const record = await storage.increment('ip:1.2.3.4', 60000, 120, 60000);

    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(60);
  });

  it('scopes redis keys with a namespaced prefix', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([1, 60000, 0, 0]) };
    const storage = new RedisThrottlerStorage(redis as unknown as never);

    await storage.increment('ip:1.2.3.4', 60000, 120, 60000);

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'cpulse:throttle:ip:1.2.3.4',
      'cpulse:throttle:ip:1.2.3.4:blocked',
      60000,
      120,
      60000,
    );
  });

  it('allows the request when redis is unreachable', async () => {
    const redis = {
      eval: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const storage = new RedisThrottlerStorage(redis as unknown as never);

    const record = await storage.increment('ip:1.2.3.4', 60000, 120, 60000);

    expect(record.isBlocked).toBe(false);
    expect(record.totalHits).toBe(0);
    expect(record.timeToExpire).toBe(60);
  });
});
