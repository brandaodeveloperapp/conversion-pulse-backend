import { Module } from '@nestjs/common';
import { ConversionController } from './controller/conversion.controller';
import { HealthController } from './controller/health.controller';

@Module({
  controllers: [ConversionController, HealthController],
})
export class HttpModule {}
