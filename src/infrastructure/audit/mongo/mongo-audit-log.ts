import { Injectable, Logger } from '@nestjs/common';
import type {
  AuditEntry,
  AuditLogPort,
} from '../../../domain/port/audit-log.port';
import { MongoConnectionService } from './mongo-connection.service';

const COLLECTION_NAME = 'audit.conversion_queries';

@Injectable()
export class MongoAuditLog implements AuditLogPort {
  private readonly logger = new Logger(MongoAuditLog.name);

  constructor(private readonly connection: MongoConnectionService) {}

  async record(entry: AuditEntry): Promise<void> {
    const collection = this.connection.collection<AuditEntry>(COLLECTION_NAME);
    if (!collection) {
      this.logger.warn('audit write skipped: mongo unavailable');
      return;
    }
    try {
      await collection.insertOne(entry);
    } catch (error) {
      this.logger.warn(`audit write failed: ${(error as Error).message}`);
    }
  }
}
