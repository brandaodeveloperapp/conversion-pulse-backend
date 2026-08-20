/**
 * Origins allowed to call the API from a browser.
 *
 * `origin: true` reflects whatever Origin the caller sends, which turns the
 * allowlist into a rubber stamp. With no CORS_ORIGINS configured the API
 * answers same-origin requests only; browsers still get the data through a
 * server-side call, which is how a dashboard should fetch it anyway.
 */
export function corsOrigin(configured?: string): string[] | boolean {
  if (configured === undefined || configured.trim() === '') {
    return false;
  }
  if (configured.trim() === '*') {
    return true;
  }
  return configured
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
