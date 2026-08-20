import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { RequestRollupRefreshUseCase } from '../../../application/use-case/refresh-rollup.use-case';

const CRON_JOB_NAME = 'cpulse-rollup-refresh';

@Injectable()
export class RollupCronService implements OnModuleInit {
  constructor(
    private readonly requestRollupRefresh: RequestRollupRefreshUseCase,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const cronTime = this.config.get<string>('ROLLUP_CRON', '0 */15 * * * *');
    const job = CronJob.from({
      cronTime,
      onTick: () => this.tick(),
      start: true,
    });
    this.scheduler.addCronJob(CRON_JOB_NAME, job);
  }

  private tick(): void {
    void this.requestRollupRefresh.execute(
      'scheduled',
      new Date().toISOString(),
    );
  }
}
