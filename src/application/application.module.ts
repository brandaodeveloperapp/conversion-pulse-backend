import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { GetConversionTimeseriesUseCase } from './use-case/get-conversion-timeseries.use-case';
import { ListChannelsUseCase } from './use-case/list-channels.use-case';
import {
  RefreshRollupUseCase,
  RequestRollupRefreshUseCase,
} from './use-case/refresh-rollup.use-case';

export interface ApplicationModuleOptions {
  rollupPublishing?: boolean;
}

/**
 * Wires the use cases available to a process.
 *
 * `rollupPublishing` is off for the worker: it consumes refresh messages and
 * never publishes them, so it must not instantiate a use case that depends on
 * the ROLLUP_QUEUE port its process does not provide.
 */
@Global()
@Module({})
export class ApplicationModule {
  static forRoot(options: ApplicationModuleOptions = {}): DynamicModule {
    const rollupPublishing = options.rollupPublishing ?? true;

    const useCases: Provider[] = [
      GetConversionTimeseriesUseCase,
      ListChannelsUseCase,
      RefreshRollupUseCase,
    ];
    if (rollupPublishing) {
      useCases.push(RequestRollupRefreshUseCase);
    }

    return {
      module: ApplicationModule,
      global: true,
      providers: useCases,
      exports: useCases,
    };
  }
}
