import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { RollupPublisherService } from './rollup-publisher.service';

const CRON_JOB_NAME = 'cpulse-rollup-refresh';

@Injectable()
export class RollupCronService implements OnModuleInit {
  private readonly logger = new Logger(RollupCronService.name);

  constructor(
    private readonly publisher: RollupPublisherService,
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
    const published = this.publisher.publish('scheduled');
    if (!published) {
      this.logger.warn(
        'scheduled rollup refresh not published, rabbitmq unavailable',
      );
    }
  }
}
