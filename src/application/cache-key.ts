import { createHash } from 'node:crypto';
import { TimeseriesCriteria } from '../domain/port/conversion-repository.port';

export const SERIES_CACHE_PREFIX = 'cpulse:ts:';

/** Chave estável para um recorte: canais e status são ordenados antes do hash,
 * então `?a=1&b=2` e `?b=2&a=1` colidem na mesma entrada. */
export function seriesCacheKey(criteria: TimeseriesCriteria): string {
  const canonical = JSON.stringify({
    from: criteria.range.from,
    to: criteria.range.to,
    granularity: criteria.granularity,
    channels: criteria.channels ? [...criteria.channels].sort() : null,
    conversionStatuses: [...criteria.conversionStatuses].sort((a, b) => a - b),
  });
  return (
    SERIES_CACHE_PREFIX + createHash('sha1').update(canonical).digest('hex')
  );
}
