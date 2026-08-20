export const SERIES_CACHE = Symbol('SERIES_CACHE');

/** Cache de resposta. Toda implementação degrada em silêncio: indisponibilidade
 * do cache nunca propaga erro para quem chama. */
export interface SeriesCachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidatePrefix(prefix: string): Promise<void>;
}
