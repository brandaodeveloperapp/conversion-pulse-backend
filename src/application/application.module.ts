import { Module } from '@nestjs/common';
import { GetConversionTimeseriesUseCase } from './use-case/get-conversion-timeseries.use-case';
import { ListChannelsUseCase } from './use-case/list-channels.use-case';
import {
  RefreshRollupUseCase,
  RequestRollupRefreshUseCase,
} from './use-case/refresh-rollup.use-case';

const USE_CASES = [
  GetConversionTimeseriesUseCase,
  ListChannelsUseCase,
  RefreshRollupUseCase,
  RequestRollupRefreshUseCase,
];

@Module({
  providers: USE_CASES,
  exports: USE_CASES,
})
export class ApplicationModule {}
