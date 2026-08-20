export const RESPONSE_STATUS = {
  Valid: 1,
  Invalid: 2,
  Incomplete: 3,
  Pending: 4,
  Opened: 5,
  Viewed: 6,
} as const;

export type ResponseStatusId =
  (typeof RESPONSE_STATUS)[keyof typeof RESPONSE_STATUS];

export const STATUS_COLUMN: Readonly<Record<number, string>> = {
  [RESPONSE_STATUS.Valid]: 'valid',
  [RESPONSE_STATUS.Invalid]: 'invalid',
  [RESPONSE_STATUS.Incomplete]: 'incomplete',
  [RESPONSE_STATUS.Pending]: 'pending',
  [RESPONSE_STATUS.Opened]: 'opened',
  [RESPONSE_STATUS.Viewed]: 'viewed',
};

export const DEFAULT_CONVERSION_STATUSES: readonly number[] = [
  RESPONSE_STATUS.Valid,
];

export function statusColumns(statuses: readonly number[]): string[] {
  return [
    ...new Set(
      statuses
        .map((id) => STATUS_COLUMN[id])
        .filter((column): column is string => Boolean(column)),
    ),
  ];
}
