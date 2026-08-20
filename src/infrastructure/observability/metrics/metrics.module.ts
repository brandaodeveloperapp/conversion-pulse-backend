import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

export interface MetricsModuleOptions {
  httpInterceptor?: boolean;
}

@Module({})
export class MetricsModule {
  static forRoot(options: MetricsModuleOptions = {}): DynamicModule {
    const httpInterceptor = options.httpInterceptor ?? true;
    const providers: Provider[] = [MetricsService];
    if (httpInterceptor) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: HttpMetricsInterceptor,
      });
    }

    return {
      module: MetricsModule,
      global: true,
      controllers: [MetricsController],
      providers,
      exports: [MetricsService],
    };
  }
}
