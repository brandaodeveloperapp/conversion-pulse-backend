import { Injectable } from '@nestjs/common';
import { PostgresConnection } from './postgres-connection.service';
import {
  RollupRefresherPort,
  RollupStats,
} from '../../../domain/port/rollup-refresher.port';
import {
  EVENTS_BY_CHANNEL_SQL,
  refreshSql,
  ROLLUP_ROWS_SQL,
} from './rollup.sql';

@Injectable()
export class PgRollupRefresher implements RollupRefresherPort {
  constructor(private readonly db: PostgresConnection) {}

  async refresh(concurrently: boolean): Promise<void> {
    await this.db.query(refreshSql(concurrently));
  }

  async stats(): Promise<RollupStats> {
    const [rowsResult] = await this.db.query<{ rows: string }>(ROLLUP_ROWS_SQL);
    const perChannel = await this.db.query<{ channel: string; total: string }>(
      EVENTS_BY_CHANNEL_SQL,
    );
    return {
      rollupRows: Number(rowsResult?.rows ?? 0),
      eventsByChannel: new Map(
        perChannel.map((row) => [row.channel, Number(row.total)]),
      ),
    };
  }
}
