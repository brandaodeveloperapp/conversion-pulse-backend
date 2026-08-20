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
import { CacheService } from '../../../../infrastructure/cache/redis/cache.service';
import { PostgresConnection } from '../../../../infrastructure/persistence/postgres/postgres-connection.service';
import { RabbitConnectionService } from '../../../../infrastructure/messaging/rabbitmq/rabbit-connection.service';

interface DependencyStatus {
  reachable: boolean;
  latencyMs?: number;
  error?: string;
}

interface ReadinessBody {
  status: 'ok' | 'degraded';
  database: DependencyStatus;
  redis: DependencyStatus;
  rabbitmq: DependencyStatus;
}

@ApiTags('health')
@Controller({ path: 'health/ready', version: VERSION_NEUTRAL })
export class ReadyController {
  constructor(
    private readonly db: PostgresConnection,
    private readonly cache: CacheService,
    private readonly rabbit: RabbitConnectionService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness: banco, redis e rabbitmq.' })
  async check(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ReadinessBody> {
    const [database, redis, rabbitmq] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkRabbit(),
    ]);
    const ok = database.reachable && redis.reachable && rabbitmq.reachable;
    if (!ok) reply.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'degraded', database, redis, rabbitmq };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    const started = Date.now();
    try {
      await this.db.query('SELECT 1');
      return { reachable: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { reachable: false, error: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const started = Date.now();
    try {
      const reachable = await this.cache.ping();
      return { reachable, latencyMs: Date.now() - started };
    } catch (error) {
      return { reachable: false, error: (error as Error).message };
    }
  }

  private checkRabbit(): Promise<DependencyStatus> {
    return Promise.resolve({ reachable: this.rabbit.getChannel() !== null });
  }
}
