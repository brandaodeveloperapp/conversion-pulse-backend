import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ChannelRow } from '../src/conversion/conversion.service';
import { ConversionResponseDto } from '../src/conversion/dto/conversion-response.dto';
import { DatabaseService } from '../src/database/database.service';

type QueryFn = (text: string, params?: unknown[]) => Promise<unknown[]>;

interface HealthResponseBody {
  status: string;
  database: {
    reachable: boolean;
  };
}

const boundsRow = { min_day: '2025-01-01', max_day: '2025-01-31' };
const seriesRow = {
  period: '2025-01-01',
  channel: 'email',
  sent: '100',
  converted: '10',
  delivered: '90',
  opened: '20',
  viewed: '5',
};
const channelRow = {
  channel: 'email',
  sent: '100',
  first_day: '2025-01-01',
  last_day: '2025-01-31',
};
const healthRow = { rows: '9500000' };

function mockQueryImplementation(text: string): Promise<unknown[]> {
  if (text.includes('min_day')) {
    return Promise.resolve([boundsRow]);
  }
  if (text.includes('first_day')) {
    return Promise.resolve([channelRow]);
  }
  if (text.includes('count(*)')) {
    return Promise.resolve([healthRow]);
  }
  return Promise.resolve([seriesRow]);
}

describe('Conversion Pulse API (e2e)', () => {
  let app: NestFastifyApplication;
  let queryMock: jest.Mock<ReturnType<QueryFn>, Parameters<QueryFn>>;

  beforeAll(async () => {
    queryMock = jest.fn<ReturnType<QueryFn>, Parameters<QueryFn>>(
      mockQueryImplementation,
    );
    const mockDb = { query: queryMock } as unknown as DatabaseService;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(mockDb)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(() => {
    queryMock.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with a reachable database', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    const body = response.body as HealthResponseBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.database.reachable).toBe(true);
  });

  it('GET /health returns 503 with reachable false when the database query rejects', async () => {
    queryMock.mockRejectedValueOnce(new Error('connection refused'));

    const response = await request(app.getHttpServer()).get('/health');
    const body = response.body as HealthResponseBody;

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.database.reachable).toBe(false);
  });

  it('GET /api/v1/conversion/timeseries returns 200 with meta/totals/series shape', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/conversion/timeseries',
    );
    const body = response.body as ConversionResponseDto;

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('meta');
    expect(body).toHaveProperty('totals');
    expect(body).toHaveProperty('series');
    expect(Array.isArray(body.series)).toBe(true);
  });

  it('GET /api/v1/conversion/timeseries?channels=lixo returns 400', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/conversion/timeseries?channels=lixo',
    );

    expect(response.status).toBe(400);
  });

  it('GET /api/v1/conversion/channels returns 200 with a channel list', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/conversion/channels',
    );
    const body = response.body as ChannelRow[];

    expect(response.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({ channel: 'email' });
  });
});
