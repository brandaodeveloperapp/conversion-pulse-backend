import type { FastifyRequest } from 'fastify';

export const UNMATCHED_ROUTE = 'unmatched_route';

export function getRouteTemplate(request: FastifyRequest): string {
  return request.routeOptions.url ?? UNMATCHED_ROUTE;
}
