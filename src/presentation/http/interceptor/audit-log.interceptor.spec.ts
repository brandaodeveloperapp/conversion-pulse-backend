import type { ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import type { AuditEntry } from '../../../domain/port/audit-log.port';

function buildContext(
  request: Record<string, unknown>,
  reply: Record<string, unknown>,
): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
    }),
  } as unknown as ExecutionContext;
}

function buildReply(overrides: Record<string, unknown> = {}) {
  return {
    statusCode: 200,
    getHeader: jest.fn().mockReturnValue(undefined),
    ...overrides,
  };
}

describe('AuditLogInterceptor', () => {
  let auditLog: { record: jest.Mock<Promise<void>, [AuditEntry]> };
  let interceptor: AuditLogInterceptor;

  beforeEach(() => {
    auditLog = {
      record: jest.fn<Promise<void>, [AuditEntry]>().mockResolvedValue(),
    };
    interceptor = new AuditLogInterceptor(auditLog);
  });

  it('records an entry for a conversion route on success', (done) => {
    const request = {
      method: 'GET',
      query: { from: '2024-01-01' },
      routeOptions: { url: '/api/v1/conversion/timeseries' },
    };
    const reply = buildReply({
      getHeader: jest.fn().mockReturnValue('HIT'),
    });
    const next = { handle: () => of({ series: [1, 2, 3] }) };

    interceptor
      .intercept(buildContext(request, reply), next as never)
      .subscribe(() => {
        expect(auditLog.record).toHaveBeenCalledTimes(1);
        const entry = auditLog.record.mock.calls[0][0];
        expect(entry.route).toBe('/api/v1/conversion/timeseries');
        expect(entry.method).toBe('GET');
        expect(entry.query).toEqual({ from: '2024-01-01' });
        expect(entry.resultCount).toBe(3);
        expect(entry.cacheHit).toBe(true);
        expect(entry.statusCode).toBe(200);
        expect(typeof entry.latencyMs).toBe('number');
        expect(typeof entry.occurredAt).toBe('string');
        done();
      });
  });

  it('records a null resultCount and the error status on failure', (done) => {
    const request = {
      method: 'GET',
      query: {},
      routeOptions: { url: '/api/v1/conversion/timeseries' },
    };
    const reply = buildReply();
    const next = { handle: () => throwError(() => new Error('boom')) };

    interceptor
      .intercept(buildContext(request, reply), next as never)
      .subscribe({
        error: () => {
          expect(auditLog.record).toHaveBeenCalledTimes(1);
          const entry = auditLog.record.mock.calls[0][0];
          expect(entry.resultCount).toBeNull();
          expect(entry.statusCode).toBe(500);
          done();
        },
      });
  });

  it('skips routes outside the conversion API', (done) => {
    const request = {
      method: 'GET',
      query: {},
      routeOptions: { url: '/health' },
    };
    const reply = buildReply();
    const next = { handle: () => of({ status: 'ok' }) };

    interceptor
      .intercept(buildContext(request, reply), next as never)
      .subscribe(() => {
        expect(auditLog.record).not.toHaveBeenCalled();
        done();
      });
  });

  it('skips the metrics route', (done) => {
    const request = {
      method: 'GET',
      query: {},
      routeOptions: { url: '/metrics' },
    };
    const reply = buildReply();
    const next = { handle: () => of('') };

    interceptor
      .intercept(buildContext(request, reply), next as never)
      .subscribe(() => {
        expect(auditLog.record).not.toHaveBeenCalled();
        done();
      });
  });
});
