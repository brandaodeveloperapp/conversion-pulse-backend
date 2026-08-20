import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, Document, MongoClient } from 'mongodb';

const DEFAULT_URL = 'mongodb://localhost:27017';
const DEFAULT_DB = 'cpulse_audit';
const SERVER_SELECTION_TIMEOUT_MS = 2000;

/** Owns the single Mongo connection used for audit logging.
 * Never throws: a failed connect leaves the service unavailable and every
 * caller degrades instead of failing the request that triggered the audit. */
@Injectable()
export class MongoConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoConnectionService.name);
  private client: MongoClient | null = null;
  private available = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('AUDIT_MONGO_URL', DEFAULT_URL);
    const client = new MongoClient(url, {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    });
    client.on('error', (error: Error) => {
      this.logger.warn(`mongo audit connection error: ${error.message}`);
    });
    try {
      await client.connect();
      this.client = client;
      this.available = true;
      this.logger.log('mongo audit connection ready');
    } catch (error) {
      this.available = false;
      this.logger.warn(
        `mongo audit connection unavailable: ${(error as Error).message}`,
      );
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  collection<T extends Document = Document>(
    name: string,
  ): Collection<T> | null {
    if (!this.client || !this.available) return null;
    return this.client.db(DEFAULT_DB).collection<T>(name);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close().catch(() => undefined);
    }
  }
}
