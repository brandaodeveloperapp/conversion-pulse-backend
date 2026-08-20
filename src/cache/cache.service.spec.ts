import { CacheService } from './cache.service';
import { MetricsService } from '../observability/metrics/metrics.service';

type RedisMock = {
  get: jest.Mock;
  set: jest.Mock;
  scan: jest.Mock;
  unlink: jest.Mock;
  ping: jest.Mock;
  quit: jest.Mock;
};

function buildRedisMock(): RedisMock {
  return {
    get: jest.fn(),
    set: jest.fn(),
    scan: jest.fn(),
    unlink: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  };
}

describe('CacheService', () => {
  let redis: RedisMock;
  let metrics: { recordCacheOperation: jest.Mock };
  let service: CacheService;

  beforeEach(() => {
    redis = buildRedisMock();
    metrics = { recordCacheOperation: jest.fn() };
    service = new CacheService(
      redis as unknown as never,
      metrics as unknown as MetricsService,
    );
  });

  describe('get', () => {
    it('returns parsed value and records a hit', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ a: 1 }));

      const result = await service.get<{ a: number }>('key');

      expect(result).toEqual({ a: 1 });
      expect(metrics.recordCacheOperation).toHaveBeenCalledWith('hit');
    });

    it('returns null and records a miss when key is absent', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.get('key');

      expect(result).toBeNull();
      expect(metrics.recordCacheOperation).toHaveBeenCalledWith('miss');
    });

    it('degrades to null and records an error when redis fails', async () => {
      redis.get.mockRejectedValue(new Error('connection refused'));

      const result = await service.get('key');

      expect(result).toBeNull();
      expect(metrics.recordCacheOperation).toHaveBeenCalledWith('error');
    });
  });

  describe('set', () => {
    it('stores the serialized value with the given ttl', async () => {
      redis.set.mockResolvedValue('OK');

      await service.set('key', { a: 1 }, 60);

      expect(redis.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ a: 1 }),
        'EX',
        60,
      );
    });

    it('swallows redis errors and records an error metric', async () => {
      redis.set.mockRejectedValue(new Error('connection refused'));

      await expect(service.set('key', { a: 1 }, 60)).resolves.toBeUndefined();
      expect(metrics.recordCacheOperation).toHaveBeenCalledWith('error');
    });
  });

  describe('invalidatePrefix', () => {
    it('scans iteratively across pages until cursor returns to zero', async () => {
      redis.scan
        .mockResolvedValueOnce(['1', ['cpulse:ts:a', 'cpulse:ts:b']])
        .mockResolvedValueOnce(['0', ['cpulse:ts:c']]);
      redis.unlink.mockResolvedValue(2).mockResolvedValueOnce(2);

      const deleted = await service.invalidatePrefix('cpulse:ts:');

      expect(redis.scan).toHaveBeenCalledTimes(2);
      expect(redis.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'cpulse:ts:*',
        'COUNT',
        100,
      );
      expect(deleted).toBeGreaterThan(0);
    });

    it('never calls KEYS and degrades gracefully on scan failure', async () => {
      redis.scan.mockRejectedValue(new Error('connection refused'));

      const deleted = await service.invalidatePrefix('cpulse:ts:');

      expect(deleted).toBe(0);
      expect(metrics.recordCacheOperation).toHaveBeenCalledWith('error');
    });
  });

  describe('ping', () => {
    it('returns true when redis replies PONG', async () => {
      redis.ping.mockResolvedValue('PONG');
      await expect(service.ping()).resolves.toBe(true);
    });

    it('propagates errors so readiness checks can detect an outage', async () => {
      redis.ping.mockRejectedValue(new Error('connection refused'));
      await expect(service.ping()).rejects.toThrow('connection refused');
    });
  });
});
