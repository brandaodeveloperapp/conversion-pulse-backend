import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { ConversionModule } from './conversion/conversion.module';
import { HealthController } from './health/health.controller';
import { MetricsModule } from './observability/metrics/metrics.module';
import { HealthModule } from './observability/health/health.module';
import { buildPinoLoggerParams } from './observability/logging/pino-logger.config';
import { CacheModule } from './cache/cache.module';
import { MessagingModule } from './messaging/messaging.module';

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
    DatabaseModule,
    ConversionModule,
    MetricsModule.forRoot(),
    CacheModule.forRoot(),
    MessagingModule.forRoot(),
    HealthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
