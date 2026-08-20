export interface AppConfig {
  port: number;
  databaseUrl: string;
  poolMax: number;
  statementTimeoutMs: number;
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://cpulse:cpulse@localhost:5432/cpulse',
  poolMax: Number(process.env.DB_POOL_MAX ?? 10),
  statementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15000),
});
