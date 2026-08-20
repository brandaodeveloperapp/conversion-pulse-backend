import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';
import { getRouteTemplate } from './route.util';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const route = getRouteTemplate(request);
    const method = request.method;
    const started = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.record(method, route, reply.statusCode, started),
        error: (error: unknown) =>
          this.record(method, route, this.resolveErrorStatus(error), started),
      }),
    );
  }

  private record(
    method: string,
    route: string,
    statusCode: number,
    started: bigint,
  ): void {
    const durationSeconds = Number(process.hrtime.bigint() - started) / 1e9;
    this.metrics.observeHttpRequest(method, route, statusCode, durationSeconds);
  }

  private resolveErrorStatus(error: unknown): number {
    return error instanceof HttpException ? error.getStatus() : 500;
  }
}
