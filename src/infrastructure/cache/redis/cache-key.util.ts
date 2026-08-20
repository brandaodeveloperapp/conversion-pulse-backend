import { createHash } from 'node:crypto';

export const CACHE_KEY_PREFIX = 'cpulse:ts:';

export function normalizeQueryString(rawQuery: string): string {
  const params = new URLSearchParams(rawQuery);
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(sorted).toString();
}

export function buildTimeseriesCacheKey(rawQuery: string): string {
  const hash = createHash('sha1')
    .update(normalizeQueryString(rawQuery))
    .digest('hex');
  return `${CACHE_KEY_PREFIX}${hash}`;
}
