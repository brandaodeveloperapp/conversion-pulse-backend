import { DynamicModule, Module } from '@nestjs/common';
import { AUDIT_LOG } from '../../../domain/port/audit-log.port';
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
      ],
      exports: [AUDIT_LOG],
    };
  }
}
