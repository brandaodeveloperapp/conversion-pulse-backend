import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitConnectionService } from './rabbit-connection.service';
import {
  RollupRefreshReason,
  buildRollupRefreshMessage,
} from './rollup-refresh.message';

@Injectable()
export class RollupPublisherService {
  private readonly logger = new Logger(RollupPublisherService.name);

  constructor(
    private readonly connection: RabbitConnectionService,
    private readonly config: ConfigService,
  ) {}

  publish(reason: RollupRefreshReason): boolean {
    const channel = this.connection.getChannel();
    if (!channel) {
      this.logger.warn(
        `rabbitmq channel unavailable, skipping publish reason=${reason}`,
      );
      return false;
    }

    const exchange = this.config.get<string>(
      'ROLLUP_EXCHANGE',
      'cpulse.rollup',
    );
    const routingKey = this.config.get<string>(
      'ROLLUP_ROUTING_KEY',
      'rollup.refresh',
    );
    const message = buildRollupRefreshMessage(reason);
    const content = Buffer.from(JSON.stringify(message), 'utf8');

    return channel.publish(exchange, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
    });
  }
}
