import { Controller, Get } from '@nestjs/common';
import { GatewayConfigService } from './gateway-config.service';

interface ServiceHealth {
  status: 'up' | 'down';
  url: string;
  latencyMs?: number;
  error?: string;
}

@Controller()
export class HealthController {
  constructor(private readonly configService: GatewayConfigService) {}

  @Get(['health', 'api/health'])
  async checkHealth() {
    const servicesToCheck = [
      { name: 'user', url: this.configService.userServiceUrl },
      { name: 'ticket', url: this.configService.ticketServiceUrl },
      { name: 'chat', url: this.configService.chatServiceUrl },
      { name: 'knowledge', url: this.configService.knowledgeServiceUrl },
      { name: 'analytics', url: this.configService.analyticsServiceUrl },
    ];

    const results: Record<string, ServiceHealth> = {};
    let allUp = true;

    await Promise.all(
      servicesToCheck.map(async ({ name, url }) => {
        const start = Date.now();
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1500);
          timer.unref();
          const res = await fetch(`${url}/health`, {
            signal: controller.signal,
          }).catch(async () => {
            // fallback to probe baseURL if /health doesn't respond
            return await fetch(`${url}/api/health`, { signal: controller.signal });
          });
          clearTimeout(timer);

          const latencyMs = Date.now() - start;
          if (res.ok || res.status < 500) {
            results[name] = { status: 'up', url, latencyMs };
          } else {
            results[name] = { status: 'down', url, latencyMs, error: `HTTP ${res.status}` };
            allUp = false;
          }
        } catch (err: any) {
          results[name] = {
            status: 'down',
            url,
            latencyMs: Date.now() - start,
            error: err.message,
          };
          allUp = false;
        }
      }),
    );

    return {
      status: allUp ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: results,
    };
  }
}
