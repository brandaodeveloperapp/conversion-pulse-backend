import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export type CacheOperationResult = 'hit' | 'miss' | 'error';
export type RollupRefreshResult = 'success' | 'failure';

const HTTP_DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];
const DB_DURATION_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
];
const ROLLUP_DURATION_BUCKETS = [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300];

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  private readonly httpRequestDuration = new Histogram({
    name: 'cpulse_http_request_duration_seconds',
    help: 'Duração das requisições HTTP em segundos.',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: HTTP_DURATION_BUCKETS,
    registers: [this.registry],
  });

  private readonly httpRequestsTotal = new Counter({
    name: 'cpulse_http_requests_total',
    help: 'Total de requisições HTTP.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  private readonly dbQueryDuration = new Histogram({
    name: 'cpulse_db_query_duration_seconds',
    help: 'Duração das queries no banco em segundos.',
    labelNames: ['operation'] as const,
    buckets: DB_DURATION_BUCKETS,
    registers: [this.registry],
  });

  private readonly cacheOperationsTotal = new Counter({
    name: 'cpulse_cache_operations_total',
    help: 'Total de operações de cache.',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  private readonly rollupRefreshTotal = new Counter({
    name: 'cpulse_rollup_refresh_total',
    help: 'Total de execuções de refresh do rollup.',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  private readonly rollupRefreshDuration = new Histogram({
    name: 'cpulse_rollup_refresh_duration_seconds',
    help: 'Duração do refresh do rollup em segundos.',
    buckets: ROLLUP_DURATION_BUCKETS,
    registers: [this.registry],
  });

  private readonly rollupRows = new Gauge({
    name: 'cpulse_rollup_rows',
    help: 'Quantidade de linhas na materialized view de rollup.',
    registers: [this.registry],
  });

  private readonly eventsTotal = new Gauge({
    name: 'cpulse_events_total',
    help: 'Total de eventos por canal na materialized view de rollup.',
    labelNames: ['channel'] as const,
    registers: [this.registry],
  });

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (!this.isEnabled()) return;
    this.registry.setDefaultLabels({
      service: this.config.get<string>(
        'OTEL_SERVICE_NAME',
        'conversion-pulse-api',
      ),
    });
    collectDefaultMetrics({ register: this.registry });
  }

  isEnabled(): boolean {
    return this.config.get<string>('METRICS_ENABLED', 'true') !== 'false';
  }

  observeHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestDuration.observe(labels, durationSeconds);
    this.httpRequestsTotal.inc(labels);
  }

  observeDbQuery(operation: string, durationSeconds: number): void {
    this.dbQueryDuration.observe({ operation }, durationSeconds);
  }

  recordCacheOperation(result: CacheOperationResult): void {
    this.cacheOperationsTotal.inc({ result });
  }

  recordRollupRefresh(
    result: RollupRefreshResult,
    durationSeconds: number,
  ): void {
    this.rollupRefreshTotal.inc({ result });
    this.rollupRefreshDuration.observe(durationSeconds);
  }

  setRollupRows(count: number): void {
    this.rollupRows.set(count);
  }

  setEventsTotal(channel: string, count: number): void {
    this.eventsTotal.set({ channel }, count);
  }

  metricsText(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
