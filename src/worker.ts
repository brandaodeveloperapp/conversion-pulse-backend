import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import configuration from './config/configuration';
import { CacheModule } from './cache/cache.module';
import { DatabaseModule } from './database/database.module';
import { MessagingModule } from './messaging/messaging.module';
import { MetricsModule } from './observability/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
    DatabaseModule,
    MetricsModule.forRoot({ httpInterceptor: false }),
    CacheModule.forRoot({
      enableHttpInterceptor: false,
      enableRateLimit: false,
    }),
    MessagingModule.forRoot({ publisher: false, cron: false, consumer: true }),
  ],
})
class WorkerModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks([], { useProcessExit: true });
  Logger.log('worker ready', 'worker');
}

void bootstrap();
