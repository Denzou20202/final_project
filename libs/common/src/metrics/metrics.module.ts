import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsController } from './metrics.controller.js';
import { MetricsMiddleware } from './metrics.middleware.js';
import { MetricsService } from './metrics.service.js';

// Exposes GET /api/metrics (Prometheus text format) and records a
// request-duration histogram + counter for every HTTP request via a global
// middleware. Import into each service's AppModule — same shared-module
// pattern as NotificationsQueueModule/SearchIndexQueueModule; no extra
// wiring needed, configure() below applies the middleware automatically.
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsMiddleware],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
