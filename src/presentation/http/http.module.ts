import { Module } from '@nestjs/common';
import { ApplicationModule } from '../../application/application.module';
import { ConversionController } from './controller/conversion.controller';
import { HealthController } from './controller/health.controller';

@Module({
  imports: [ApplicationModule],
  controllers: [ConversionController, HealthController],
})
export class HttpModule {}
