import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel, ConsumeMessage } from 'amqplib';
import { CACHE_KEY_PREFIX } from '../cache/cache-key.util';
import { CacheService } from '../cache/cache.service';
import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../observability/metrics/metrics.service';
import { RabbitConnectionService } from './rabbit-connection.service';
import { parseRollupRefreshMessage } from './rollup-refresh.message';

const ROLLUP_VIEW = 'inside.conversion_daily';

interface RollupCountRow {
  rows: string;
}

interface RollupChannelRow {
  channel: string;
  total: string;
}

@Injectable()
export class RollupConsumerService implements OnModuleInit {
  private readonly logger = new Logger(RollupConsumerService.name);

  constructor(
    private readonly connection: RabbitConnectionService,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly metrics: MetricsService,
    private readonly cache: CacheService,
  ) {}

  onModuleInit(): void {
    this.connection.onChannelReady((channel) => this.subscribe(channel));
  }

  private async subscribe(channel: Channel): Promise<void> {
    const queue = this.config.get<string>(
      'ROLLUP_QUEUE',
      'cpulse.rollup.refresh',
    );
    await channel.consume(
      queue,
      (msg) => {
        void this.handle(channel, msg);
      },
      { noAck: false },
    );
  }

  private async handle(
    channel: Channel,
    msg: ConsumeMessage | null,
  ): Promise<void> {
    if (!msg) return;
    try {
      parseRollupRefreshMessage(msg.content);
    } catch (error) {
      this.logger.warn(
        `invalid rollup refresh message: ${(error as Error).message}`,
      );
      channel.nack(msg, false, false);
      return;
    }
    await this.refresh(channel, msg);
  }

  private async refresh(channel: Channel, msg: ConsumeMessage): Promise<void> {
    const started = Date.now();
    try {
      await this.db.query(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY ${ROLLUP_VIEW}`,
      );
      this.metrics.recordRollupRefresh(
        'success',
        (Date.now() - started) / 1000,
      );
      await this.updateGauges();
      await this.cache.invalidatePrefix(CACHE_KEY_PREFIX);
      channel.ack(msg);
    } catch (error) {
      this.logger.error(`rollup refresh failed: ${(error as Error).message}`);
      this.metrics.recordRollupRefresh(
        'failure',
        (Date.now() - started) / 1000,
      );
      channel.nack(msg, false, false);
    }
  }

  private async updateGauges(): Promise<void> {
    const [rowsResult, channelRows] = await Promise.all([
      this.db.query<RollupCountRow>(
        `SELECT count(*)::text AS rows FROM ${ROLLUP_VIEW}`,
      ),
      this.db.query<RollupChannelRow>(
        `SELECT channel, sum(sent)::text AS total FROM ${ROLLUP_VIEW} GROUP BY channel`,
      ),
    ]);
    this.metrics.setRollupRows(Number(rowsResult[0]?.rows ?? 0));
    for (const row of channelRows) {
      this.metrics.setEventsTotal(row.channel, Number(row.total));
    }
  }
}
