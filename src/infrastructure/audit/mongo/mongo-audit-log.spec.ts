import { MongoAuditLog } from './mongo-audit-log';
import { MongoConnectionService } from './mongo-connection.service';
import type { AuditEntry } from '../../../domain/port/audit-log.port';

function buildEntry(): AuditEntry {
  return {
    route: '/api/v1/conversion/timeseries',
    method: 'GET',
    query: { from: '2024-01-01' },
    resultCount: 5,
    latencyMs: 12.5,
    cacheHit: false,
    statusCode: 200,
    occurredAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('MongoAuditLog', () => {
  it('inserts the entry when mongo is available', async () => {
    const insertOne = jest.fn().mockResolvedValue({ insertedId: '1' });
    const connection = {
      collection: jest.fn().mockReturnValue({ insertOne }),
    };
    const auditLog = new MongoAuditLog(
      connection as unknown as MongoConnectionService,
    );
    const entry = buildEntry();

    await auditLog.record(entry);

    expect(insertOne).toHaveBeenCalledWith(entry);
  });

  it('resolves without throwing when mongo is unavailable', async () => {
    const connection = { collection: jest.fn().mockReturnValue(null) };
    const auditLog = new MongoAuditLog(
      connection as unknown as MongoConnectionService,
    );

    await expect(auditLog.record(buildEntry())).resolves.toBeUndefined();
  });

  it('swallows insert errors instead of propagating them', async () => {
    const insertOne = jest
      .fn()
      .mockRejectedValue(new Error('connection refused'));
    const connection = {
      collection: jest.fn().mockReturnValue({ insertOne }),
    };
    const auditLog = new MongoAuditLog(
      connection as unknown as MongoConnectionService,
    );

    await expect(auditLog.record(buildEntry())).resolves.toBeUndefined();
  });
});
