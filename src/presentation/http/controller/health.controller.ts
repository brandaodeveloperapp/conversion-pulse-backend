import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { MetricsService } from '../../../infrastructure/observability/metrics/metrics.service';
import { PostgresConnection } from '../../../infrastructure/persistence/postgres/postgres-connection.service';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly db: PostgresConnection,
    private readonly metrics: MetricsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness e readiness do processo e do banco.' })
  async check(@Res({ passthrough: true }) reply: FastifyReply) {
    const started = Date.now();
    try {
      const [row] = await this.db.query<{ rows: string }>(
        'SELECT count(*)::text AS rows FROM inside.conversion_daily',
      );
      const rollupRows = Number(row?.rows ?? 0);
      this.metrics.setRollupRows(rollupRows);
      return {
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        database: {
          reachable: true,
          latencyMs: Date.now() - started,
          rollupRows,
        },
      };
    } catch (error) {
      reply.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: 'degraded',
        uptimeSeconds: Math.round(process.uptime()),
        database: {
          reachable: false,
          latencyMs: Date.now() - started,
          error:
            error instanceof Error ? error.message : 'unknown database error',
        },
      };
    }
  }
}
