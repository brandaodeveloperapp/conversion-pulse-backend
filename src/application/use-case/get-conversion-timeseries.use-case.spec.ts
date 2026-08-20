import {
  GetConversionTimeseriesUseCase,
  type TimeseriesView,
} from './get-conversion-timeseries.use-case';
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

function countsOf(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    period: `2025-01-${String(i + 1).padStart(2, '0')}`,
    channel: 'email',
    sent: 100,
    converted: 10,
    delivered: 90,
    opened: 20,
    viewed: 5,
  }));
}

describe('GetConversionTimeseriesUseCase pagination', () => {
  it('returns the full series and no pagination when pageSize is absent', async () => {
    const repository = buildRepository();
    repository.findTimeseries.mockResolvedValue({
      counts: countsOf(5),
      queryMs: 2,
    });
    const view = await buildUseCase(repository, buildCache()).execute({
      granularity: 'day',
    });

    expect(view.series).toHaveLength(5);
    expect(view.pagination).toBeUndefined();
  });

  it('slices to the requested page and reports pagination meta', async () => {
    const repository = buildRepository();
    repository.findTimeseries.mockResolvedValue({
      counts: countsOf(5),
      queryMs: 2,
    });
    const view = await buildUseCase(repository, buildCache()).execute({
      granularity: 'day',
      page: 2,
      pageSize: 2,
    });

    expect(view.series).toHaveLength(2);
    expect(view.series[0].period).toBe('2025-01-03');
    expect(view.pagination).toEqual({
      page: 2,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
    });
  });

  it('keeps totals computed over the full series, not the page', async () => {
    const repository = buildRepository();
    repository.findTimeseries.mockResolvedValue({
      counts: countsOf(5),
      queryMs: 2,
    });
    const view = await buildUseCase(repository, buildCache()).execute({
      granularity: 'day',
      pageSize: 2,
    });

    expect(view.totals.sent).toBe(500);
    expect(view.series).toHaveLength(2);
  });

  it('clamps an out-of-range page to the last page', async () => {
    const repository = buildRepository();
    repository.findTimeseries.mockResolvedValue({
      counts: countsOf(5),
      queryMs: 2,
    });
    const view = await buildUseCase(repository, buildCache()).execute({
      granularity: 'day',
      page: 99,
      pageSize: 2,
    });

    expect(view.pagination?.page).toBe(3);
    expect(view.series).toHaveLength(1);
    expect(view.series[0].period).toBe('2025-01-05');
  });

  it('caches the full series so pagination never multiplies cache keys', async () => {
    const repository = buildRepository();
    repository.findTimeseries.mockResolvedValue({
      counts: countsOf(5),
      queryMs: 2,
    });
    const cache = buildCache();
    await buildUseCase(repository, cache).execute({
      granularity: 'day',
      pageSize: 2,
    });

    const cached = (cache.set.mock.calls[0] as unknown[])[1] as TimeseriesView;
    expect(cached.series).toHaveLength(5);
    expect(cached.pagination).toBeUndefined();
  });
});
