import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConversionController } from './controller/conversion.controller';
import { HealthController } from './controller/health.controller';
import { AuditLogInterceptor } from './interceptor/audit-log.interceptor';

@Module({
  controllers: [ConversionController, HealthController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }],
})
export class HttpModule {}
