import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RollupQueuePort } from '../../../domain/port/rollup-queue.port';
import type { RollupRefreshMessage } from '../../../domain/port/rollup-queue.port';
import { RabbitConnectionService } from './rabbit-connection.service';

@Injectable()
export class RollupPublisherService implements RollupQueuePort {
  private readonly logger = new Logger(RollupPublisherService.name);

  constructor(
    private readonly connection: RabbitConnectionService,
    private readonly config: ConfigService,
  ) {}

  publishRefresh(message: RollupRefreshMessage): Promise<void> {
    const channel = this.connection.getChannel();
    if (!channel) {
      this.logger.warn(
        `rabbitmq channel unavailable, skipping publish reason=${message.reason}`,
      );
      return Promise.resolve();
    }

    const exchange = this.config.get<string>(
      'ROLLUP_EXCHANGE',
      'cpulse.rollup',
    );
    const routingKey = this.config.get<string>(
      'ROLLUP_ROUTING_KEY',
      'rollup.refresh',
    );
    const content = Buffer.from(JSON.stringify(message), 'utf8');

    channel.publish(exchange, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
    });
    return Promise.resolve();
  }
}
