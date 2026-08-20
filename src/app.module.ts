import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import configuration from './shared/config/configuration';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { CacheModule } from './infrastructure/cache/redis/cache.module';
import { AuditModule } from './infrastructure/audit/mongo/audit.module';
import { MessagingModule } from './infrastructure/messaging/rabbitmq/messaging.module';
import { MetricsModule } from './infrastructure/observability/metrics/metrics.module';
import { buildPinoLoggerParams } from './infrastructure/observability/logging/pino-logger.config';
import { ApplicationModule } from './application/application.module';
import { HttpModule } from './presentation/http/http.module';
import { ReadinessModule } from './presentation/http/controller/ready/readiness.module';

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
    AuditModule.forRoot(),
    CacheModule.forRoot(),
    MetricsModule.forRoot(),
    MessagingModule.forRoot(),
    ApplicationModule.forRoot(),
    HttpModule,
    ReadinessModule,
  ],
})
export class AppModule {}
