import { Global, Module } from '@nestjs/common';
import { PostgresConnection } from './postgres-connection.service';

@Global()
@Module({
  providers: [PostgresConnection],
  exports: [PostgresConnection],
})
export class PostgresModule {}
