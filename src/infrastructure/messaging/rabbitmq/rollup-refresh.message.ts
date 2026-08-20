export type RollupRefreshReason = 'scheduled' | 'manual';

export interface RollupRefreshMessage {
  requestedAt: string;
  reason: RollupRefreshReason;
  concurrently: boolean;
}

const VALID_REASONS: readonly RollupRefreshReason[] = ['scheduled', 'manual'];

export function buildRollupRefreshMessage(
  reason: RollupRefreshReason,
): RollupRefreshMessage {
  return { requestedAt: new Date().toISOString(), reason, concurrently: true };
}

export function parseRollupRefreshMessage(
  content: Buffer,
): RollupRefreshMessage {
  const payload = parseJson(content);
  return validateRollupRefreshMessage(payload);
}

function parseJson(content: Buffer): unknown {
  try {
    return JSON.parse(content.toString('utf8'));
  } catch {
    throw new Error('rollup refresh message is not valid JSON');
  }
}

function validateRollupRefreshMessage(payload: unknown): RollupRefreshMessage {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('rollup refresh message must be an object');
  }
  const { requestedAt, reason, concurrently } = payload as Record<
    string,
    unknown
  >;
  assertRequestedAt(requestedAt);
  assertReason(reason);
  assertConcurrently(concurrently);
  return {
    requestedAt,
    reason: reason,
    concurrently,
  };
}

function assertRequestedAt(value: unknown): asserts value is string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error('requestedAt must be an ISO-8601 date string');
  }
}

function assertReason(value: unknown): asserts value is RollupRefreshReason {
  if (
    typeof value !== 'string' ||
    !VALID_REASONS.includes(value as RollupRefreshReason)
  ) {
    throw new Error('reason must be "scheduled" or "manual"');
  }
}

function assertConcurrently(value: unknown): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new Error('concurrently must be a boolean');
  }
}
