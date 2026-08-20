import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ConversionQueryDto, Granularity } from './dto/conversion-query.dto';
import {
  ConversionPointDto,
  ConversionResponseDto,
} from './dto/conversion-response.dto';

const STATUS_COLUMN: Readonly<Record<number, string>> = {
  1: 'valid',
  2: 'invalid',
  3: 'incomplete',
  4: 'pending',
  5: 'opened',
  6: 'viewed',
};

const ROLLUP = 'inside.conversion_daily';

interface RollupRow {
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

export interface ChannelRow {
  channel: string;
  sent: string;
  first_day: string;
  last_day: string;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0
    ? null
    : Number((numerator / denominator).toFixed(6));
}

@Injectable()
export class ConversionService {
  constructor(private readonly db: DatabaseService) {}

  private convertedExpression(statuses: number[]): string {
    const columns = [
      ...new Set(
        statuses
          .map((id) => STATUS_COLUMN[id])
          .filter((c): c is string => Boolean(c)),
      ),
    ];
    return columns.length ? columns.map((c) => `sum(${c})`).join(' + ') : '0';
  }

  async bounds(): Promise<{ from: string; to: string }> {
    const [row] = await this.db.query<BoundsRow>(
      `SELECT min(day)::text AS min_day, max(day)::text AS max_day FROM ${ROLLUP}`,
    );
    return {
      from: row?.min_day ?? '1970-01-01',
      to: row?.max_day ?? '1970-01-01',
    };
  }

  async channels(): Promise<ChannelRow[]> {
    return this.db.query<ChannelRow>(
      `SELECT channel,
              sum(sent)::bigint AS sent,
              min(day)::text    AS first_day,
              max(day)::text    AS last_day
       FROM ${ROLLUP}
       GROUP BY channel
       ORDER BY sum(sent) DESC`,
    );
  }

  async timeseries(query: ConversionQueryDto): Promise<ConversionResponseDto> {
    const bounds = await this.bounds();
    const from = query.from?.slice(0, 10) ?? bounds.from;
    const to = query.to?.slice(0, 10) ?? bounds.to;
    const truncUnit =
      query.granularity === Granularity.Day ? 'day' : query.granularity;
    const converted = this.convertedExpression(query.conversionStatuses);

    const sql = `
      SELECT to_char(date_trunc($3, day::timestamp), 'YYYY-MM-DD') AS period,
             channel,
             sum(sent)::bigint      AS sent,
             (${converted})::bigint AS converted,
             sum(delivered)::bigint AS delivered,
             sum(opened)::bigint    AS opened,
             sum(viewed)::bigint    AS viewed
      FROM ${ROLLUP}
      WHERE day >= $1::date AND day <= $2::date
        AND ($4::text[] IS NULL OR channel = ANY($4))
      GROUP BY 1, 2
      ORDER BY 1, 2`;

    const started = Date.now();
    const rows = await this.db.query<RollupRow>(sql, [
      from,
      to,
      truncUnit,
      query.channels ?? null,
    ]);
    const queryMs = Date.now() - started;

    const series: ConversionPointDto[] = rows.map((r) => {
      const sent = Number(r.sent);
      const convertedCount = Number(r.converted);
      const delivered = Number(r.delivered);
      const opened = Number(r.opened);
      return {
        period: r.period,
        channel: r.channel,
        sent,
        converted: convertedCount,
        delivered,
        opened,
        viewed: Number(r.viewed),
        conversionRate: ratio(convertedCount, sent),
        openRate: ratio(opened, delivered),
      };
    });

    const totals = series.reduce(
      (acc, p) => {
        acc.sent += p.sent;
        acc.converted += p.converted;
        acc.delivered += p.delivered;
        return acc;
      },
      { sent: 0, converted: 0, delivered: 0 },
    );

    return {
      meta: {
        from,
        to,
        granularity: query.granularity,
        channels: query.channels ?? [...new Set(series.map((p) => p.channel))],
        conversionStatuses: query.conversionStatuses,
        queryMs,
        source: 'conversion_daily',
      },
      totals: {
        ...totals,
        conversionRate: ratio(totals.converted, totals.sent),
      },
      series,
    };
  }
}
