import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel, ConsumeMessage } from 'amqplib';
import { RefreshRollupUseCase } from '../../../application/use-case/refresh-rollup.use-case';
import { MetricsService } from '../../observability/metrics/metrics.service';
import { RabbitConnectionService } from './rabbit-connection.service';
import { parseRollupRefreshMessage } from './rollup-refresh.message';

@Injectable()
export class RollupConsumerService implements OnModuleInit {
  private readonly logger = new Logger(RollupConsumerService.name);

  constructor(
    private readonly connection: RabbitConnectionService,
    private readonly config: ConfigService,
    private readonly refreshRollup: RefreshRollupUseCase,
    private readonly metrics: MetricsService,
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
    let concurrently: boolean;
    try {
      concurrently = parseRollupRefreshMessage(msg.content).concurrently;
    } catch (error) {
      this.logger.warn(
        `invalid rollup refresh message: ${(error as Error).message}`,
      );
      channel.nack(msg, false, false);
      return;
    }
    await this.refresh(channel, msg, concurrently);
  }

  private async refresh(
    channel: Channel,
    msg: ConsumeMessage,
    concurrently: boolean,
  ): Promise<void> {
    const started = Date.now();
    try {
      const outcome = await this.refreshRollup.execute(concurrently);
      this.metrics.setRollupRows(outcome.rollupRows);
      this.metrics.recordRollupRefresh(
        'success',
        (Date.now() - started) / 1000,
      );
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
}
