import { Module } from '@nestjs/common';
import { ReadyController } from './ready.controller';

@Module({
  controllers: [ReadyController],
})
export class HealthModule {}
