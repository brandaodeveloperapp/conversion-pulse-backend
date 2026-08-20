import { Inject, Injectable, Logger } from '@nestjs/common';
import { ROLLUP_REFRESHER } from '../../domain/port/rollup-refresher.port';
import type { RollupRefresherPort } from '../../domain/port/rollup-refresher.port';
import { SERIES_CACHE } from '../../domain/port/series-cache.port';
import type { SeriesCachePort } from '../../domain/port/series-cache.port';
import {
  ROLLUP_QUEUE,
  RollupRefreshMessage,
  RollupRefreshReason,
} from '../../domain/port/rollup-queue.port';
import type { RollupQueuePort } from '../../domain/port/rollup-queue.port';
import { SERIES_CACHE_PREFIX } from '../cache-key';

export interface RefreshOutcome {
  readonly durationMs: number;
  readonly rollupRows: number;
}

@Injectable()
export class RefreshRollupUseCase {
  private readonly logger = new Logger(RefreshRollupUseCase.name);

  constructor(
    @Inject(ROLLUP_REFRESHER) private readonly refresher: RollupRefresherPort,
    @Inject(SERIES_CACHE) private readonly cache: SeriesCachePort,
  ) {}

  async execute(concurrently: boolean): Promise<RefreshOutcome> {
    const started = Date.now();
    await this.refresher.refresh(concurrently);
    const stats = await this.refresher.stats();
    await this.cache.invalidatePrefix(SERIES_CACHE_PREFIX);
    const durationMs = Date.now() - started;
    this.logger.log(
      `rollup refreshed in ${durationMs}ms rows=${stats.rollupRows}`,
    );
    return { durationMs, rollupRows: stats.rollupRows };
  }
}

@Injectable()
export class RequestRollupRefreshUseCase {
  constructor(@Inject(ROLLUP_QUEUE) private readonly queue: RollupQueuePort) {}

  execute(
    reason: RollupRefreshReason,
    requestedAt: string,
    concurrently = true,
  ): Promise<void> {
    const message: RollupRefreshMessage = { requestedAt, reason, concurrently };
    return this.queue.publishRefresh(message);
  }
}
