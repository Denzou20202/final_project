import { EmployeeStatusEntity, EmployeeStatusHistoryEntity, UserEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

const ONLINE_STATUS_NAME = 'Онлайн';
const ONLINE_COLOR = '#22C55E';
const IDLE_STATUS_NAME = 'Неактивен';
const IDLE_COLOR = '#94A3B8';

export interface LiveStatus {
  name: string;
  color: string;
  auto: boolean;
}

interface LiveEntry {
  statusId: string | null;
  statusName: string;
  statusColor: string | null;
  idle: boolean;
}

// Live, in-memory presence-status layer — same single-instance limitation
// as PresenceService (see its own comment): correct for one chat-service
// process, would need a Redis-backed map to scale to several. The DURABLE
// half of this feature (UserEntity.currentStatusId, employee_status_history)
// is real Postgres state and survives restarts; only the idle flag and the
// "who's online right now" view are ephemeral, same as onlineOperatorIds.
@Injectable()
export class EmployeeStatusService {
  private readonly liveByOperator = new Map<string, LiveEntry>();

  constructor(
    @InjectRepository(UserEntity) private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(EmployeeStatusEntity) private readonly statusesRepository: Repository<EmployeeStatusEntity>,
    @InjectRepository(EmployeeStatusHistoryEntity) private readonly historyRepository: Repository<EmployeeStatusHistoryEntity>,
  ) {}

  // Called once per operator, only on their first connection (0 -> 1 tabs)
  // — loads their last manually-picked status from Postgres so a fresh
  // connection (or a second tab) sees the same thing everyone else does.
  async onOperatorConnect(operatorId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: operatorId } });
    const status = user?.currentStatusId
      ? await this.statusesRepository.findOne({ where: { id: user.currentStatusId } })
      : null;
    this.liveByOperator.set(operatorId, {
      statusId: status?.id ?? null,
      statusName: status?.name ?? ONLINE_STATUS_NAME,
      statusColor: status?.color ?? null,
      idle: false,
    });
  }

  onOperatorDisconnect(operatorId: string): void {
    this.liveByOperator.delete(operatorId);
  }

  // Returns false (no-op) for an unknown/deleted statusId — the gateway
  // only broadcasts on true, so a bogus id from a stale client just does
  // nothing instead of silently corrupting presence for everyone.
  async setManualStatus(operatorId: string, statusId: string | null): Promise<boolean> {
    let status: EmployeeStatusEntity | null = null;
    if (statusId) {
      status = await this.statusesRepository.findOne({ where: { id: statusId } });
      if (!status) return false;
    }
    await this.usersRepository.update({ id: operatorId }, { currentStatusId: status?.id ?? null });
    const name = status?.name ?? ONLINE_STATUS_NAME;
    const color = status?.color ?? null;
    this.liveByOperator.set(operatorId, { statusId: status?.id ?? null, statusName: name, statusColor: color, idle: false });
    await this.recordHistory(operatorId, name, color, false);
    return true;
  }

  // No-op if already idle — a client sending a redundant idle signal (e.g.
  // a second inactive tab) must not spam the history log.
  async setIdle(operatorId: string): Promise<boolean> {
    const entry = this.liveByOperator.get(operatorId);
    if (!entry || entry.idle) return false;
    this.liveByOperator.set(operatorId, { ...entry, idle: true });
    await this.recordHistory(operatorId, IDLE_STATUS_NAME, IDLE_COLOR, true);
    return true;
  }

  // Reverts the DISPLAY back to whatever manual status was already set
  // (or «Онлайн» if none) — does not touch UserEntity.currentStatusId,
  // which never changed in the first place.
  async setActive(operatorId: string): Promise<boolean> {
    const entry = this.liveByOperator.get(operatorId);
    if (!entry || !entry.idle) return false;
    this.liveByOperator.set(operatorId, { ...entry, idle: false });
    await this.recordHistory(operatorId, entry.statusName, entry.statusColor, true);
    return true;
  }

  // Omits operators with no meaningful status (statusId null, not idle) —
  // that's the default «Онлайн», which the frontend already renders for
  // anyone present in onlineOperatorIds but absent from this map.
  getSnapshot(operatorIds: string[]): Record<string, LiveStatus> {
    const snapshot: Record<string, LiveStatus> = {};
    for (const id of operatorIds) {
      const entry = this.liveByOperator.get(id);
      if (!entry) continue;
      if (entry.idle) {
        snapshot[id] = { name: IDLE_STATUS_NAME, color: IDLE_COLOR, auto: true };
      } else if (entry.statusId) {
        snapshot[id] = { name: entry.statusName, color: entry.statusColor ?? ONLINE_COLOR, auto: false };
      }
    }
    return snapshot;
  }

  private async recordHistory(
    userId: string,
    statusName: string,
    statusColor: string | null,
    automatic: boolean,
  ): Promise<void> {
    await this.historyRepository.save(this.historyRepository.create({ userId, statusName, statusColor, automatic }));
  }
}
