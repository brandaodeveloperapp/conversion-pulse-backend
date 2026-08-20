export const AUDIT_LOG = Symbol('AUDIT_LOG');

export interface AuditEntry {
  route: string;
  method: string;
  query: Record<string, unknown>;
  resultCount: number | null;
  latencyMs: number;
  cacheHit: boolean | null;
  statusCode: number;
  occurredAt: string;
}

/** Records API audit entries. Every implementation degrades in silence:
 * an unavailable audit store never propagates an error to the caller. */
export interface AuditLogPort {
  record(entry: AuditEntry): Promise<void>;
}
