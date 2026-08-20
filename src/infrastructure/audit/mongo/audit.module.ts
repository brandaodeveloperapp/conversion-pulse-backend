import { DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AUDIT_LOG } from '../../../domain/port/audit-log.port';
import { AuditLogInterceptor } from '../../../presentation/http/interceptor/audit-log.interceptor';
import { MongoAuditLog } from './mongo-audit-log';
import { MongoConnectionService } from './mongo-connection.service';

@Module({})
export class AuditModule {
  static forRoot(): DynamicModule {
    return {
      module: AuditModule,
      global: true,
      providers: [
        MongoConnectionService,
        MongoAuditLog,
        { provide: AUDIT_LOG, useExisting: MongoAuditLog },
        { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
      ],
      exports: [AUDIT_LOG],
    };
  }
}
