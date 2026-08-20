import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import configuration from './shared/config/configuration';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { CacheModule } from './infrastructure/cache/redis/cache.module';
import { MessagingModule } from './infrastructure/messaging/rabbitmq/messaging.module';
import { MetricsModule } from './infrastructure/observability/metrics/metrics.module';
import { buildPinoLoggerParams } from './infrastructure/observability/logging/pino-logger.config';
import { ApplicationModule } from './application/application.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildPinoLoggerParams,
    }),
    PersistenceModule,
    CacheModule.forRoot({
      enableHttpInterceptor: false,
      enableRateLimit: false,
    }),
    MetricsModule.forRoot({ httpInterceptor: false }),
    ApplicationModule,
    MessagingModule.forRoot({ publisher: false, cron: false, consumer: true }),
  ],
})
export class WorkerModule {}
