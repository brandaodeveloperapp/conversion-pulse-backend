import type { FastifyRequest } from 'fastify';
import { UNMATCHED_ROUTE, getRouteTemplate } from './route.util';

function buildRequest(url: string | undefined): FastifyRequest {
  return { routeOptions: { url } } as unknown as FastifyRequest;
}

describe('getRouteTemplate', () => {
  it('returns route template when matched', () => {
    const request = buildRequest('/api/v1/conversion/timeseries');
    expect(getRouteTemplate(request)).toBe('/api/v1/conversion/timeseries');
  });

  it('returns fallback when no route matched', () => {
    const request = buildRequest(undefined);
    expect(getRouteTemplate(request)).toBe(UNMATCHED_ROUTE);
  });
});
