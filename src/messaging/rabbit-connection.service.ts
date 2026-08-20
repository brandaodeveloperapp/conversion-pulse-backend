import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import type { Channel, ChannelModel, RecoveringChannelModel } from 'amqplib';

type ChannelReadyCallback = (channel: Channel) => Promise<void> | void;

@Injectable()
export class RabbitConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitConnectionService.name);
  private model: RecoveringChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly readyCallbacks: ChannelReadyCallback[] = [];

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.connect();
  }

  onChannelReady(callback: ChannelReadyCallback): void {
    this.readyCallbacks.push(callback);
    if (this.channel) {
      void callback(this.channel);
    }
  }

  getChannel(): Channel | null {
    return this.channel;
  }

  private connect(): void {
    const url = this.config.get<string>(
      'RABBITMQ_URL',
      'amqp://cpulse:cpulse@localhost:5672',
    );
    connect(url, {
      recovery: {
        initialDelay: 500,
        maxDelay: 30000,
        factor: 2,
        jitter: 0.2,
        maxRetries: Infinity,
        setup: (model: ChannelModel) => this.setupTopology(model),
      },
    })
      .then((model) => this.bindModelEvents(model))
      .catch((error: Error) =>
        this.logger.error(`rabbitmq connect failed: ${error.message}`),
      );
  }

  private bindModelEvents(model: RecoveringChannelModel): void {
    this.model = model;
    model.on('connect', () => this.logger.log('rabbitmq connected'));
    model.on('disconnect', (error) =>
      this.logger.warn(`rabbitmq disconnected: ${error.message}`),
    );
    model.on('reconnect-scheduled', (info) =>
      this.logger.warn(
        `rabbitmq reconnect attempt=${info.attempt} delay=${info.delay}ms`,
      ),
    );
    model.on('error', (error) =>
      this.logger.warn(`rabbitmq connection error: ${error.message}`),
    );
  }

  private async setupTopology(model: ChannelModel): Promise<void> {
    const exchange = this.config.get<string>(
      'ROLLUP_EXCHANGE',
      'cpulse.rollup',
    );
    const queue = this.config.get<string>(
      'ROLLUP_QUEUE',
      'cpulse.rollup.refresh',
    );
    const routingKey = this.config.get<string>(
      'ROLLUP_ROUTING_KEY',
      'rollup.refresh',
    );

    const channel = await model.createChannel();
    channel.on('error', (error) =>
      this.logger.warn(`rabbitmq channel error: ${error.message}`),
    );
    channel.on('close', () => {
      if (this.channel === channel) this.channel = null;
    });
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, routingKey);
    await channel.prefetch(1);

    this.channel = channel;
    for (const callback of this.readyCallbacks) {
      await callback(channel);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.channel = null;
    if (this.model) {
      await this.model.close().catch(() => undefined);
    }
  }
}
