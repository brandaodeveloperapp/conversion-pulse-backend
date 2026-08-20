import {
  seriesCacheKey,
  SERIES_CACHE_PREFIX,
} from '../../../application/cache-key';
import type { TimeseriesCriteria } from '../../../domain/port/conversion-repository.port';

function criteria(
  overrides: Partial<TimeseriesCriteria> = {},
): TimeseriesCriteria {
  return {
    range: { from: '2025-01-01', to: '2025-01-31' },
    granularity: 'day',
    channels: ['email', 'wpp'],
    conversionStatuses: [1, 5],
    ...overrides,
  };
}

describe('seriesCacheKey', () => {
  it('collides for criteria whose channels and statuses are reordered', () => {
    const a = criteria({
      channels: ['email', 'wpp'],
      conversionStatuses: [1, 5],
    });
    const b = criteria({
      channels: ['wpp', 'email'],
      conversionStatuses: [5, 1],
    });

    expect(seriesCacheKey(a)).toBe(seriesCacheKey(b));
  });

  it('is prefixed with the contract-defined cache key prefix', () => {
    expect(seriesCacheKey(criteria())).toMatch(
      new RegExp(`^${SERIES_CACHE_PREFIX}[0-9a-f]{40}$`),
    );
  });

  it('differs when the channel selection differs', () => {
    expect(seriesCacheKey(criteria({ channels: ['email'] }))).not.toBe(
      seriesCacheKey(criteria({ channels: ['wpp'] })),
    );
  });

  it('differs between null channels (all channels) and an explicit list', () => {
    expect(seriesCacheKey(criteria({ channels: null }))).not.toBe(
      seriesCacheKey(criteria({ channels: ['email', 'wpp'] })),
    );
  });
});
