import { ConfigService } from '@nestjs/config';
import { MongoConnectionService } from './mongo-connection.service';

const connect = jest.fn();
const close = jest.fn().mockResolvedValue(undefined);
const on = jest.fn();
const collection = jest.fn();
const db = jest.fn().mockReturnValue({ collection });

jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect,
    close,
    on,
    db,
  })),
}));

function buildConfig(): ConfigService {
  return {
    get: jest.fn().mockReturnValue('mongodb://mongo:27017'),
  } as unknown as ConfigService;
}

describe('MongoConnectionService', () => {
  beforeEach(() => {
    connect.mockReset();
    close.mockClear();
    collection.mockClear();
  });

  it('marks itself available after a successful connect', async () => {
    connect.mockResolvedValue(undefined);
    const service = new MongoConnectionService(buildConfig());

    await service.onModuleInit();

    expect(service.isAvailable()).toBe(true);
    expect(service.collection('audit.conversion_queries')).not.toBeNull();
  });

  it('never throws and stays unavailable when connect fails', async () => {
    connect.mockRejectedValue(new Error('connection refused'));
    const service = new MongoConnectionService(buildConfig());

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(service.isAvailable()).toBe(false);
    expect(service.collection('audit.conversion_queries')).toBeNull();
  });

  it('closes the client on destroy without throwing when close fails', async () => {
    connect.mockResolvedValue(undefined);
    close.mockRejectedValueOnce(new Error('already closed'));
    const service = new MongoConnectionService(buildConfig());
    await service.onModuleInit();

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
