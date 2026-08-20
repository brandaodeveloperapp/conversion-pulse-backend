import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ROLLUP_QUEUE } from '../../../domain/port/rollup-queue.port';
import { RabbitConnectionService } from './rabbit-connection.service';
import { RollupConsumerService } from './rollup-consumer.service';
import { RollupCronService } from './rollup-cron.service';
import { RollupPublisherService } from './rollup-publisher.service';

export interface MessagingModuleOptions {
  publisher?: boolean;
  consumer?: boolean;
  cron?: boolean;
}

@Module({})
export class MessagingModule {
  static forRoot(options: MessagingModuleOptions = {}): DynamicModule {
    const enableCron = options.cron ?? true;
    const enablePublisher = (options.publisher ?? true) || enableCron;
    const enableConsumer = options.consumer ?? false;

    const providers: Provider[] = [RabbitConnectionService];
    if (enablePublisher) {
      providers.push(RollupPublisherService, {
        provide: ROLLUP_QUEUE,
        useExisting: RollupPublisherService,
      });
    }
    if (enableConsumer) providers.push(RollupConsumerService);
    if (enableCron) providers.push(RollupCronService);

    const exports: Array<Provider | symbol> = [RabbitConnectionService];
    if (enablePublisher) exports.push(RollupPublisherService, ROLLUP_QUEUE);

    return {
      module: MessagingModule,
      global: true,
      imports: enableCron ? [ScheduleModule.forRoot()] : [],
      providers,
      exports,
    };
  }
}
