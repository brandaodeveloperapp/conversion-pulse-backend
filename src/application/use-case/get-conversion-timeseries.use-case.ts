import { Inject, Injectable } from '@nestjs/common';
import { CONVERSION_REPOSITORY } from '../../domain/port/conversion-repository.port';
import type {
  ConversionRepositoryPort,
  TimeseriesCriteria,
} from '../../domain/port/conversion-repository.port';
import { SERIES_CACHE } from '../../domain/port/series-cache.port';
import type { SeriesCachePort } from '../../domain/port/series-cache.port';
import {
  ConversionPoint,
  ConversionTotals,
  DateRange,
} from '../../domain/model/conversion-point';
import {
  toConversionPoint,
  totalsOf,
} from '../../domain/service/conversion-rate.calculator';
import { Granularity } from '../../domain/model/granularity';
import { DEFAULT_CONVERSION_STATUSES } from '../../domain/model/response-status';
import { seriesCacheKey, SERIES_CACHE_PREFIX } from '../cache-key';

export interface TimeseriesQuery {
  readonly from?: string;
  readonly to?: string;
  readonly granularity: Granularity;
  readonly channels?: readonly string[];
  readonly conversionStatuses?: readonly number[];
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface TimeseriesView {
  readonly range: DateRange;
  readonly granularity: Granularity;
  readonly channels: readonly string[];
  readonly conversionStatuses: readonly number[];
  readonly queryMs: number;
  readonly cached: boolean;
  readonly totals: ConversionTotals;
  readonly series: readonly ConversionPoint[];
  readonly pagination?: PaginationMeta;
}

type CachedView = Omit<TimeseriesView, 'cached'>;

@Injectable()
export class GetConversionTimeseriesUseCase {
  constructor(
    @Inject(CONVERSION_REPOSITORY)
    private readonly repository: ConversionRepositoryPort,
    @Inject(SERIES_CACHE) private readonly cache: SeriesCachePort,
  ) {}

  async execute(query: TimeseriesQuery): Promise<TimeseriesView> {
    const bounds = await this.repository.findBounds();
    const criteria: TimeseriesCriteria = {
      range: {
        from: query.from?.slice(0, 10) ?? bounds.from,
        to: query.to?.slice(0, 10) ?? bounds.to,
      },
      granularity: query.granularity,
      channels: query.channels ?? null,
      conversionStatuses:
        query.conversionStatuses ?? DEFAULT_CONVERSION_STATUSES,
    };

    const key = seriesCacheKey(criteria);
    const hit = await this.cache.get<CachedView>(key);
    if (hit) {
      return this.present(hit, true, query);
    }

    const { counts, queryMs } = await this.repository.findTimeseries(criteria);
    const series = counts.map(toConversionPoint);

    const full: CachedView = {
      range: criteria.range,
      granularity: criteria.granularity,
      channels: criteria.channels ?? [
        ...new Set(series.map((point) => point.channel)),
      ],
      conversionStatuses: criteria.conversionStatuses,
      queryMs,
      totals: totalsOf(counts),
      series,
    };

    await this.cache.set(key, full);
    return this.present(full, false, query);
  }

  private present(
    full: CachedView,
    cached: boolean,
    query: TimeseriesQuery,
  ): TimeseriesView {
    if (query.pageSize === undefined) {
      return { ...full, cached };
    }
    const pageSize = query.pageSize;
    const totalItems = full.series.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(Math.max(query.page ?? 1, 1), totalPages);
    const start = (page - 1) * pageSize;
    return {
      ...full,
      cached,
      series: full.series.slice(start, start + pageSize),
      pagination: { page, pageSize, totalItems, totalPages },
    };
  }

  async invalidateAll(): Promise<void> {
    await this.cache.invalidatePrefix(SERIES_CACHE_PREFIX);
  }
}
