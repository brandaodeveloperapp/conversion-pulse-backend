import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { getRouteTemplate } from '../../observability/metrics/route.util';
import { buildTimeseriesCacheKey } from './cache-key.util';
import { CacheService } from './cache.service';

const TIMESERIES_ROUTE = '/api/v1/conversion/timeseries';

@Injectable()
export class TimeseriesCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!this.isCacheableRequest(request)) return next.handle();

    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const key = buildTimeseriesCacheKey(request.url.split('?')[1] ?? '');

    return from(this.cache.get(key)).pipe(
      switchMap((cached) =>
        cached !== null ? this.hit(reply, cached) : this.miss(next, reply, key),
      ),
    );
  }

  private isCacheableRequest(request: FastifyRequest): boolean {
    return (
      request.method === 'GET' && getRouteTemplate(request) === TIMESERIES_ROUTE
    );
  }

  private hit(reply: FastifyReply, cached: unknown): Observable<unknown> {
    reply.header('X-Cache', 'HIT');
    return of(cached);
  }

  private miss(
    next: CallHandler,
    reply: FastifyReply,
    key: string,
  ): Observable<unknown> {
    reply.header('X-Cache', 'MISS');
    const ttl = Number(this.config.get<string>('CACHE_TTL_SECONDS', '60'));
    return next.handle().pipe(
      tap((response) => {
        void this.cache.set(key, response, ttl);
      }),
    );
  }
}
