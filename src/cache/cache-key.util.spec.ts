import {
  CACHE_KEY_PREFIX,
  buildTimeseriesCacheKey,
  normalizeQueryString,
} from './cache-key.util';

describe('normalizeQueryString', () => {
  it('sorts parameters so key order does not affect the result', () => {
    expect(normalizeQueryString('a=1&b=2')).toBe(
      normalizeQueryString('b=2&a=1'),
    );
  });

  it('produces different output for different values', () => {
    expect(normalizeQueryString('a=1')).not.toBe(normalizeQueryString('a=2'));
  });

  it('normalizes an empty query string to an empty string', () => {
    expect(normalizeQueryString('')).toBe('');
  });
});

describe('buildTimeseriesCacheKey', () => {
  it('collides for query strings with reordered parameters', () => {
    expect(buildTimeseriesCacheKey('a=1&b=2')).toBe(
      buildTimeseriesCacheKey('b=2&a=1'),
    );
  });

  it('is prefixed with the contract-defined cache key prefix', () => {
    expect(buildTimeseriesCacheKey('a=1')).toMatch(
      new RegExp(`^${CACHE_KEY_PREFIX}[0-9a-f]{40}$`),
    );
  });

  it('differs for different querystrings', () => {
    expect(buildTimeseriesCacheKey('channels=email')).not.toBe(
      buildTimeseriesCacheKey('channels=wpp'),
    );
  });
});
