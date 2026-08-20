import { ConversionService } from './conversion.service';
import { DatabaseService } from '../database/database.service';
import { ConversionQueryDto } from './dto/conversion-query.dto';

type QueryFn = (text: string, params?: unknown[]) => Promise<unknown[]>;

interface RollupRowFixture {
  period: string;
  channel: string;
  sent: string;
  converted: string;
  delivered: string;
  opened: string;
  viewed: string;
}

const boundsRow = { min_day: '2025-01-01', max_day: '2025-01-31' };

function buildQuery(
  overrides: Partial<ConversionQueryDto> = {},
): ConversionQueryDto {
  return Object.assign(new ConversionQueryDto(), overrides);
}

function buildRow(overrides: Partial<RollupRowFixture> = {}): RollupRowFixture {
  return {
    period: '2025-01-01',
    channel: 'email',
    sent: '0',
    converted: '0',
    delivered: '0',
    opened: '0',
    viewed: '0',
    ...overrides,
  };
}

describe('ConversionService', () => {
  let queryMock: jest.Mock<ReturnType<QueryFn>, Parameters<QueryFn>>;
  let db: DatabaseService;
  let service: ConversionService;

  beforeEach(() => {
    queryMock = jest.fn<ReturnType<QueryFn>, Parameters<QueryFn>>();
    db = { query: queryMock } as unknown as DatabaseService;
    service = new ConversionService(db);
  });

  describe('convertedExpression via timeseries', () => {
    it('sums only the valid column when conversionStatuses is [1]', async () => {
      queryMock.mockResolvedValueOnce([boundsRow]).mockResolvedValueOnce([]);

      await service.timeseries(buildQuery({ conversionStatuses: [1] }));

      const sql = queryMock.mock.calls[1][0];
      expect(sql).toContain('(sum(valid))::bigint AS converted');
    });

    it('sums valid and opened columns when conversionStatuses is [1, 5]', async () => {
      queryMock.mockResolvedValueOnce([boundsRow]).mockResolvedValueOnce([]);

      await service.timeseries(buildQuery({ conversionStatuses: [1, 5] }));

      const sql = queryMock.mock.calls[1][0];
      expect(sql).toContain('(sum(valid) + sum(opened))::bigint AS converted');
    });

    it('does not duplicate a column when a status id repeats', async () => {
      queryMock.mockResolvedValueOnce([boundsRow]).mockResolvedValueOnce([]);

      await service.timeseries(buildQuery({ conversionStatuses: [1, 1] }));

      const sql = queryMock.mock.calls[1][0];
      expect(sql).toContain('(sum(valid))::bigint AS converted');
      expect(sql.match(/sum\(valid\)/g)).toHaveLength(1);
    });

    it('injects nothing when a status id is outside the known map', async () => {
      queryMock.mockResolvedValueOnce([boundsRow]).mockResolvedValueOnce([]);

      await service.timeseries(buildQuery({ conversionStatuses: [99] }));

      const sql = queryMock.mock.calls[1][0];
      expect(sql).toContain('(0)::bigint AS converted');
    });
  });

  describe('conversionRate', () => {
    it('is converted divided by sent', async () => {
      queryMock
        .mockResolvedValueOnce([boundsRow])
        .mockResolvedValueOnce([buildRow({ sent: '4', converted: '1' })]);

      const result = await service.timeseries(buildQuery());

      expect(result.series[0].conversionRate).toBe(0.25);
    });

    it('is null when sent is 0', async () => {
      queryMock
        .mockResolvedValueOnce([boundsRow])
        .mockResolvedValueOnce([buildRow({ sent: '0', converted: '0' })]);

      const result = await service.timeseries(buildQuery());

      expect(result.series[0].conversionRate).toBeNull();
    });
  });

  describe('openRate', () => {
    it('is opened divided by delivered', async () => {
      queryMock
        .mockResolvedValueOnce([boundsRow])
        .mockResolvedValueOnce([buildRow({ delivered: '200', opened: '50' })]);

      const result = await service.timeseries(buildQuery());

      expect(result.series[0].openRate).toBe(0.25);
    });

    it('is null when delivered is 0', async () => {
      queryMock
        .mockResolvedValueOnce([boundsRow])
        .mockResolvedValueOnce([buildRow({ delivered: '0', opened: '0' })]);

      const result = await service.timeseries(buildQuery());

      expect(result.series[0].openRate).toBeNull();
    });
  });

  describe('totals', () => {
    it('sums sent, converted and delivered across the whole series', async () => {
      queryMock.mockResolvedValueOnce([boundsRow]).mockResolvedValueOnce([
        buildRow({
          period: '2025-01-01',
          sent: '100',
          converted: '10',
          delivered: '90',
        }),
        buildRow({
          period: '2025-01-02',
          sent: '50',
          converted: '5',
          delivered: '40',
        }),
      ]);

      const result = await service.timeseries(buildQuery());

      expect(result.totals).toEqual({
        sent: 150,
        converted: 15,
        delivered: 130,
        conversionRate: 0.1,
      });
    });
  });

  describe('from/to fallback', () => {
    it('falls back to bounds when the query has no from/to', async () => {
      queryMock.mockResolvedValueOnce([boundsRow]).mockResolvedValueOnce([]);

      const result = await service.timeseries(buildQuery());

      expect(result.meta.from).toBe(boundsRow.min_day);
      expect(result.meta.to).toBe(boundsRow.max_day);
      const params = queryMock.mock.calls[1][1] as unknown[];
      expect(params[0]).toBe(boundsRow.min_day);
      expect(params[1]).toBe(boundsRow.max_day);
    });

    it('uses the query-provided from/to when present', async () => {
      queryMock.mockResolvedValueOnce([boundsRow]).mockResolvedValueOnce([]);

      const result = await service.timeseries(
        buildQuery({ from: '2025-06-01', to: '2025-06-30' }),
      );

      expect(result.meta.from).toBe('2025-06-01');
      expect(result.meta.to).toBe('2025-06-30');
    });
  });

  describe('channels filter', () => {
    it('passes channels as an array in the $4 parameter', async () => {
      queryMock.mockResolvedValueOnce([boundsRow]).mockResolvedValueOnce([]);

      await service.timeseries(buildQuery({ channels: ['email', 'mobile'] }));

      const params = queryMock.mock.calls[1][1] as unknown[];
      expect(params[3]).toEqual(['email', 'mobile']);
    });

    it('passes null for $4 when channels is omitted', async () => {
      queryMock.mockResolvedValueOnce([boundsRow]).mockResolvedValueOnce([]);

      await service.timeseries(buildQuery());

      const params = queryMock.mock.calls[1][1] as unknown[];
      expect(params[3]).toBeNull();
    });
  });
});
