import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResultRow } from 'pg';

/** Thin wrapper over a single pg connection pool shared by the app. */
@Injectable()
export class PostgresConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresConnection.name);
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('databaseUrl'),
      max: config.getOrThrow<number>('poolMax'),
      statement_timeout: config.getOrThrow<number>('statementTimeoutMs'),
      application_name: 'conversion-pulse-api',
    });
    this.pool.on('error', (err) =>
      this.logger.error('idle pool client error', err.stack),
    );
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
    this.logger.log('database pool ready');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const started = Date.now();
    const result = await this.pool.query<T>(text, params);
    this.logger.debug(
      `query ${Date.now() - started}ms rows=${result.rowCount ?? 0}`,
    );
    return result.rows;
  }
}
