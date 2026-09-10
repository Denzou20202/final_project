import { SettingsAuditLogEntity } from '@veloxdesk/database';
import { SettingsAuditEventType, SettingsAuditModule } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface SettingsAuditLogInput {
  actorId: string | null;
  module: SettingsAuditModule;
  eventType: SettingsAuditEventType;
  entityId: string | null;
  entityLabel: string;
  changes?: Record<string, unknown> | null;
}

// Shared by every module that manages a piece of admin configuration —
// ticket-service's SLA policies/custom fields/automation rules, user-
// service's permission groups — so «кто и когда менял» is one table, not
// four independent ones. A plain TypeORM-repository write, not a BullMQ
// producer (unlike NotificationsProducerService): user-service doesn't
// configure BullModule at all, and every consumer of this service already
// shares the same Postgres `entities` array, so there's no new bootstrap
// wiring needed to add this to any app.
@Injectable()
export class SettingsAuditLogService {
  constructor(
    @InjectRepository(SettingsAuditLogEntity)
    private readonly repository: Repository<SettingsAuditLogEntity>,
  ) {}

  async log(input: SettingsAuditLogInput): Promise<void> {
    await this.repository.save(this.repository.create(input));
  }
}
