import { Injectable } from '@nestjs/common';
import { MetricsService } from '../../observability/metrics/metrics.service';
import { PostgresConnection } from './postgres-connection.service';
import {
  ConversionRepositoryPort,
  TimeseriesCriteria,
  TimeseriesResult,
} from '../../../domain/port/conversion-repository.port';
import {
  ChannelVolume,
  ConversionCounts,
  DateRange,
} from '../../../domain/model/conversion-point';
import { statusColumns } from '../../../domain/model/response-status';
import { BOUNDS_SQL, CHANNELS_SQL, timeseriesSql } from './rollup.sql';

const EPOCH = '1970-01-01';

interface CountsRow {
  period: string;
  channel: string;
  sent: string;
  converted: string;
  delivered: string;
  opened: string;
  viewed: string;
}

interface BoundsRow {
  min_day: string | null;
  max_day: string | null;
}

interface ChannelRow {
  channel: string;
  sent: string;
  first_day: string;
  last_day: string;
}

@Injectable()
export class PgConversionRepository implements ConversionRepositoryPort {
  constructor(
    private readonly db: PostgresConnection,
    private readonly metrics: MetricsService,
  ) {}

  private async timed<T>(
    operation: string,
    run: () => Promise<T>,
  ): Promise<[T, number]> {
    const started = Date.now();
    const result = await run();
    const elapsedMs = Date.now() - started;
    this.metrics.observeDbQuery(operation, elapsedMs / 1000);
    return [result, elapsedMs];
  }

  async findBounds(): Promise<DateRange> {
    const [rows] = await this.timed('bounds', () =>
      this.db.query<BoundsRow>(BOUNDS_SQL),
    );
    const [row] = rows;
    return { from: row?.min_day ?? EPOCH, to: row?.max_day ?? EPOCH };
  }

  async listChannels(): Promise<ChannelVolume[]> {
    const [rows] = await this.timed('channels', () =>
      this.db.query<ChannelRow>(CHANNELS_SQL),
    );
    const channels = rows.map((row) => ({
      channel: row.channel,
      sent: Number(row.sent),
      firstDay: row.first_day,
      lastDay: row.last_day,
    }));
    for (const channel of channels) {
      this.metrics.setEventsTotal(channel.channel, channel.sent);
    }
    return channels;
  }

  async findTimeseries(
    criteria: TimeseriesCriteria,
  ): Promise<TimeseriesResult> {
    const sql = timeseriesSql(statusColumns(criteria.conversionStatuses));
    const [rows, queryMs] = await this.timed('timeseries', () =>
      this.db.query<CountsRow>(sql, [
        criteria.range.from,
        criteria.range.to,
        criteria.granularity,
        criteria.channels ? [...criteria.channels] : null,
      ]),
    );

    const counts: ConversionCounts[] = rows.map((row) => ({
      period: row.period,
      channel: row.channel,
      sent: Number(row.sent),
      converted: Number(row.converted),
      delivered: Number(row.delivered),
      opened: Number(row.opened),
      viewed: Number(row.viewed),
    }));

    return { counts, queryMs };
  }
}
