export const ROLLUP_REFRESHER = Symbol('ROLLUP_REFRESHER');

export interface RollupStats {
  readonly rollupRows: number;
  readonly eventsByChannel: ReadonlyMap<string, number>;
}

export interface RollupRefresherPort {
  refresh(concurrently: boolean): Promise<void>;
  stats(): Promise<RollupStats>;
}
