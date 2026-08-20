import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'DATABASE_URL',
  'REDIS_URL',
  'RABBITMQ_URL',
  '*.DATABASE_URL',
  '*.REDIS_URL',
  '*.RABBITMQ_URL',
  '*.authorization',
];

export function buildPinoLoggerParams(config: ConfigService): Params {
  const serviceName = config.get<string>(
    'OTEL_SERVICE_NAME',
    'conversion-pulse-api',
  );
  return {
    pinoHttp: {
      level: config.get<string>('LOG_LEVEL', 'info'),
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      autoLogging: true,
      base: { service: serviceName },
    },
  };
}
