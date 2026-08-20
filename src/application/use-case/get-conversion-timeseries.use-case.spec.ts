import { GetConversionTimeseriesUseCase } from './get-conversion-timeseries.use-case';
import type { SeriesCachePort } from '../../domain/port/series-cache.port';

const BOUNDS = { from: '2025-01-01', to: '2025-01-31' };

interface RepositoryMock {
  findBounds: jest.Mock;
  findTimeseries: jest.Mock;
  listChannels: jest.Mock;
}

interface CacheMock {
  get: jest.Mock;
  set: jest.Mock;
  invalidatePrefix: jest.Mock;
}

function buildRepository(): RepositoryMock {
  return {
    findBounds: jest.fn().mockResolvedValue(BOUNDS),
    findTimeseries: jest.fn().mockResolvedValue({
      counts: [
        {
          period: '2025-01-01',
          channel: 'email',
          sent: 100,
          converted: 10,
          delivered: 90,
          opened: 20,
          viewed: 5,
        },
      ],
      queryMs: 3,
    }),
    listChannels: jest.fn(),
  };
}

function buildCache(): CacheMock {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    invalidatePrefix: jest.fn().mockResolvedValue(undefined),
  };
}

function buildUseCase(
  repository: RepositoryMock,
  cache: CacheMock,
): GetConversionTimeseriesUseCase {
  return new GetConversionTimeseriesUseCase(
    repository,
    cache as SeriesCachePort,
  );
}

describe('GetConversionTimeseriesUseCase', () => {
  it('returns cached=true and skips the repository on a cache hit', async () => {
    const repository = buildRepository();
    const cache = buildCache();
    cache.get.mockResolvedValue({
      range: BOUNDS,
      granularity: 'day',
      channels: ['email'],
      conversionStatuses: [1],
      queryMs: 1,
      totals: { sent: 100, converted: 10, delivered: 90, conversionRate: 0.1 },
      series: [],
    });
    const useCase = buildUseCase(repository, cache);

    const view = await useCase.execute({ granularity: 'day' });

    expect(view.cached).toBe(true);
    expect(repository.findTimeseries).not.toHaveBeenCalled();
  });

  it('calls the repository and populates the cache on a cache miss', async () => {
    const repository = buildRepository();
    const cache = buildCache();
    const useCase = buildUseCase(repository, cache);

    const view = await useCase.execute({ granularity: 'day' });

    expect(view.cached).toBe(false);
    expect(repository.findTimeseries).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('falls back to repository bounds when from/to are absent', async () => {
    const repository = buildRepository();
    const cache = buildCache();
    const useCase = buildUseCase(repository, cache);

    const view = await useCase.execute({ granularity: 'day' });

    expect(repository.findBounds).toHaveBeenCalledTimes(1);
    expect(view.range).toEqual(BOUNDS);
    expect(repository.findTimeseries).toHaveBeenCalledWith(
      expect.objectContaining({ range: BOUNDS }),
    );
  });
});
