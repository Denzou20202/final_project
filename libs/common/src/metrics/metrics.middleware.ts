import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    // Hooking res.on('finish') instead of a NestInterceptor: Nest runs
    // Guards before Interceptors, so a request an AuthGuard rejects (401)
    // never reaches an interceptor and would be invisible in metrics —
    // exactly the auth-failure signal ops needs. Middleware wraps the whole
    // Express response cycle, so every exit path (guard rejection, thrown
    // exception, 404, success) is counted.
    response.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      // Route path with :param placeholders (e.g. /tickets/:id), not the
      // raw URL — otherwise every distinct ticket id (or every path a bot
      // scans on the public IP) becomes its own label value and cardinality
      // grows unbounded. By the time 'finish' fires, Express has already
      // matched the route (or not, hence the 'unmatched' fallback for 404s).
      const route = (request.route as { path?: string } | undefined)?.path ?? 'unmatched';
      const labels = { method: request.method, route, status_code: String(response.statusCode) };
      this.metrics.httpRequestDuration.observe(labels, durationSeconds);
      this.metrics.httpRequestTotal.inc(labels);
    });

    next();
  }
}
