export const TRUSTED_PROXY_CIDRS = [
  '127.0.0.1/8',
  '::1/128',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  'fc00::/7',
];

/**
 * Proxy hops Fastify is allowed to believe when resolving the client IP.
 *
 * `trustProxy: true` trusts every hop, which makes Fastify take the leftmost
 * entry of X-Forwarded-For — a value the client writes. Rate limiting keyed on
 * that IP is then bypassed by sending a different header on each request.
 * Restricting the trust to private ranges makes the resolver stop at the first
 * address it cannot vouch for, which is the real client.
 */
export function trustedProxies(configured?: string): string[] | string {
  if (configured === undefined || configured.trim() === '') {
    return TRUSTED_PROXY_CIDRS;
  }
  return configured
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
