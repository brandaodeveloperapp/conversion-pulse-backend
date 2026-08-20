export const GRANULARITIES = ['day', 'week', 'month'] as const;

export type Granularity = (typeof GRANULARITIES)[number];

export function isGranularity(value: string): value is Granularity {
  return (GRANULARITIES as readonly string[]).includes(value);
}
