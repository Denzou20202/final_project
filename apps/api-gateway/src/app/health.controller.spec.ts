import { Test, TestingModule } from '@nestjs/testing';
import { GatewayConfigService } from './gateway-config.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [GatewayConfigService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('reports ok when all upstreams respond', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const result = await controller.checkHealth();
    expect(result.status).toBe('ok');
    expect(result.services.user.status).toBe('up');
    expect(result.services.ticket.status).toBe('up');
    expect(result.services.chat.status).toBe('up');
    expect(result.services.knowledge.status).toBe('up');
    expect(result.services.analytics.status).toBe('up');
  });

  it('reports degraded when an upstream fails', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      if (typeof url === 'string' && url.includes('3005')) {
        throw new Error('Connection refused');
      }
      return { ok: true, status: 200 } as any;
    });

    const result = await controller.checkHealth();
    expect(result.status).toBe('degraded');
    expect(result.services.analytics.status).toBe('down');
  });
});
