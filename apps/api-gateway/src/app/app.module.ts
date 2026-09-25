import { Module } from '@nestjs/common';
import { GatewayConfigService } from './gateway-config.service';
import { HealthController } from './health.controller';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  imports: [],
  controllers: [HealthController, ProxyController],
  providers: [GatewayConfigService, ProxyService],
})
export class AppModule {}
