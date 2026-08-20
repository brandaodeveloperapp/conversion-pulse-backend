import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async scrape(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    if (!this.metrics.isEnabled()) {
      reply.status(HttpStatus.NOT_FOUND);
      return '';
    }
    reply.header('content-type', this.metrics.contentType);
    return this.metrics.metricsText();
  }
}
