export const CHANNELS = ['email', 'mobile', 'wpp'] as const;

export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

export function normalizeChannel(origin: string): string {
  return origin.trim().toLowerCase();
}
