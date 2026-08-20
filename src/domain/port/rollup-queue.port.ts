export const ROLLUP_QUEUE = Symbol('ROLLUP_QUEUE');

export type RollupRefreshReason = 'scheduled' | 'manual';

export interface RollupRefreshMessage {
  readonly requestedAt: string;
  readonly reason: RollupRefreshReason;
  readonly concurrently: boolean;
}

export interface RollupQueuePort {
  publishRefresh(message: RollupRefreshMessage): Promise<void>;
}
