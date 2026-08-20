import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { trustedProxies } from './shared/config/trusted-proxies';
import { corsOrigin } from './shared/config/cors-origin';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: trustedProxies(process.env.TRUSTED_PROXIES),
    }),
  );

  app.useLogger(app.get(Logger));
  app.enableCors({
    origin: corsOrigin(process.env.CORS_ORIGINS),
    methods: ['GET'],
  });
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/ready', 'metrics'],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Conversion Pulse API')
    .setDescription(
      'Evolução temporal da taxa de conversão por canal sobre 9,5M de envios.',
    )
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
