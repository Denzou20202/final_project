import { JwtPayload, SettingsAuditLogService } from '@veloxdesk/common';
import { SettingsAuditEventType, SettingsAuditModule } from '@veloxdesk/types';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto.js';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto.js';
import { PublicSlaPolicy, toPublicSlaPolicy } from './sla-policy.public.js';
import { SlaPoliciesRepository } from './sla-policies.repository.js';

// Postgres error code for a foreign_key_violation — raised when deleting a
// policy that a ticket still references (the FK has no ON DELETE action).
const FOREIGN_KEY_VIOLATION = '23503';
// Raised by the UNIQUE constraint on priority (see migration
// AddSlaPolicyPriorityUnique) — the findByPriority pre-check below is only
// an early, friendlier error for the common case; two concurrent creates
// for the same priority can both pass it, and this is what actually stops
// the second one from inserting a duplicate.
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class SlaPoliciesService {
  constructor(
    private readonly slaPoliciesRepository: SlaPoliciesRepository,
    private readonly settingsAuditLog: SettingsAuditLogService,
  ) {}

  async create(dto: CreateSlaPolicyDto, actor: JwtPayload): Promise<PublicSlaPolicy> {
    this.assertResolutionNotBeforeResponse(dto.responseTimeMin, dto.resolutionTimeMin);

    const existing = await this.slaPoliciesRepository.findByPriority(dto.priority);
    if (existing) {
      throw new ConflictException(`A policy for priority "${dto.priority}" already exists`);
    }

    try {
      const policy = await this.slaPoliciesRepository.create(dto);
      await this.settingsAuditLog.log({
        actorId: actor.sub,
        module: SettingsAuditModule.SLA_POLICY,
        eventType: SettingsAuditEventType.CREATED,
        entityId: policy.id,
        entityLabel: policy.name,
        changes: { ...dto },
      });
      return toPublicSlaPolicy(policy);
    } catch (error) {
      throw this.translateUniqueViolation(error, dto.priority);
    }
  }

  async list(): Promise<PublicSlaPolicy[]> {
    const policies = await this.slaPoliciesRepository.findAll();
    return policies.map(toPublicSlaPolicy);
  }

  async findOne(id: string): Promise<PublicSlaPolicy> {
    const policy = await this.getPolicyOrThrow(id);
    return toPublicSlaPolicy(policy);
  }

  async update(id: string, dto: UpdateSlaPolicyDto, actor: JwtPayload): Promise<PublicSlaPolicy> {
    const policy = await this.getPolicyOrThrow(id);

    this.assertResolutionNotBeforeResponse(
      dto.responseTimeMin ?? policy.responseTimeMin,
      dto.resolutionTimeMin ?? policy.resolutionTimeMin,
    );

    if (dto.priority && dto.priority !== policy.priority) {
      const existing = await this.slaPoliciesRepository.findByPriority(dto.priority);
      if (existing) {
        throw new ConflictException(`A policy for priority "${dto.priority}" already exists`);
      }
    }

    try {
      await this.slaPoliciesRepository.update(id, dto);
    } catch (error) {
      throw this.translateUniqueViolation(error, dto.priority ?? policy.priority);
    }
    const updated = await this.getPolicyOrThrow(id);
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.SLA_POLICY,
      eventType: SettingsAuditEventType.UPDATED,
      entityId: updated.id,
      entityLabel: updated.name,
      changes: { ...dto },
    });
    return toPublicSlaPolicy(updated);
  }

  async remove(id: string, actor: JwtPayload): Promise<void> {
    const policy = await this.getPolicyOrThrow(id);
    try {
      await this.slaPoliciesRepository.delete(id);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as unknown as { code?: string }).code === FOREIGN_KEY_VIOLATION) {
        throw new ConflictException('Cannot delete a policy that tickets still reference');
      }
      throw error;
    }
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.SLA_POLICY,
      eventType: SettingsAuditEventType.DELETED,
      entityId: policy.id,
      entityLabel: policy.name,
    });
  }

  private translateUniqueViolation(error: unknown, priority: string): unknown {
    if (error instanceof QueryFailedError && (error as unknown as { code?: string }).code === UNIQUE_VIOLATION) {
      return new ConflictException(`A policy for priority "${priority}" already exists`);
    }
    return error;
  }

  private assertResolutionNotBeforeResponse(responseTimeMin: number, resolutionTimeMin: number): void {
    if (resolutionTimeMin < responseTimeMin) {
      throw new BadRequestException('resolutionTimeMin must be greater than or equal to responseTimeMin');
    }
  }

  private async getPolicyOrThrow(id: string) {
    const policy = await this.slaPoliciesRepository.findById(id);
    if (!policy) {
      throw new NotFoundException('SLA policy not found');
    }
    return policy;
  }
}
