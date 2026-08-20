import { Global, Module } from '@nestjs/common';
import { PostgresModule } from './postgres/postgres.module';
import { PgConversionRepository } from './postgres/pg-conversion.repository';
import { PgRollupRefresher } from './postgres/pg-rollup-refresher';
import { CONVERSION_REPOSITORY } from '../../domain/port/conversion-repository.port';
import { ROLLUP_REFRESHER } from '../../domain/port/rollup-refresher.port';

@Global()
@Module({
  imports: [PostgresModule],
  providers: [
    { provide: CONVERSION_REPOSITORY, useClass: PgConversionRepository },
    { provide: ROLLUP_REFRESHER, useClass: PgRollupRefresher },
  ],
  exports: [CONVERSION_REPOSITORY, ROLLUP_REFRESHER, PostgresModule],
})
export class PersistenceModule {}
