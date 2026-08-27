import { AUTOMATION_TRIGGER_QUEUE_NAME } from '@veloxdesk/types';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AutomationTriggerProducerService } from './automation-trigger-producer.service.js';

// Producer side, importable from any service that needs to fire a
// Dispatcher trigger (ticket-service, chat-service). ticket-service also
// registers the consuming @Processor against this same queue name — see
// AutomationModule there.
@Module({
  imports: [BullModule.registerQueue({ name: AUTOMATION_TRIGGER_QUEUE_NAME })],
  providers: [AutomationTriggerProducerService],
  exports: [AutomationTriggerProducerService],
})
export class AutomationTriggerQueueModule {}
