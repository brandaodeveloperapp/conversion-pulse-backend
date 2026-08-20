import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { AUDIT_LOG } from '../../../domain/port/audit-log.port';
import type {
  AuditEntry,
  AuditLogPort,
} from '../../../domain/port/audit-log.port';

const AUDITED_ROUTE_PREFIX = '/api/v1/conversion';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(@Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const route = request.routeOptions.url ?? '';
    if (!route.startsWith(AUDITED_ROUTE_PREFIX)) return next.handle();

    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const occurredAt = new Date().toISOString();
    const started = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: (body: unknown) =>
          this.record(
            request,
            reply,
            route,
            body,
            occurredAt,
            started,
            reply.statusCode,
          ),
        error: (error: unknown) =>
          this.record(
            request,
            reply,
            route,
            null,
            occurredAt,
            started,
            this.resolveErrorStatus(error),
          ),
      }),
    );
  }

  private record(
    request: FastifyRequest,
    reply: FastifyReply,
    route: string,
    body: unknown,
    occurredAt: string,
    started: bigint,
    statusCode: number,
  ): void {
    const entry: AuditEntry = {
      route,
      method: request.method,
      query: (request.query as Record<string, unknown>) ?? {},
      resultCount: this.resultCount(body),
      latencyMs: Number(process.hrtime.bigint() - started) / 1e6,
      cacheHit: this.cacheHit(reply),
      statusCode,
      occurredAt,
    };
    void this.auditLog.record(entry);
  }

  private resultCount(body: unknown): number | null {
    if (Array.isArray(body)) return body.length;
    const series = (body as { series?: unknown } | null)?.series;
    return Array.isArray(series) ? series.length : null;
  }

  private cacheHit(reply: FastifyReply): boolean | null {
    const header = reply.getHeader('X-Cache');
    if (header === 'HIT') return true;
    if (header === 'MISS') return false;
    return null;
  }

  private resolveErrorStatus(error: unknown): number {
    return error instanceof HttpException ? error.getStatus() : 500;
  }
}
