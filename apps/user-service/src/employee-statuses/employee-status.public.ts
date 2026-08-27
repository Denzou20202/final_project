import { EmployeeStatusEntity, EmployeeStatusHistoryEntity } from '@veloxdesk/database';

export interface PublicEmployeeStatus {
  id: string;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  color: string;
  createdAt: Date;
}

export function toPublicEmployeeStatus(status: EmployeeStatusEntity): PublicEmployeeStatus {
  return {
    id: status.id,
    name: status.name,
    nameUk: status.nameUk ?? null,
    nameEn: status.nameEn ?? null,
    color: status.color,
    createdAt: status.createdAt,
  };
}

export interface PublicStatusHistoryEntry {
  id: string;
  statusName: string;
  statusColor: string | null;
  automatic: boolean;
  createdAt: Date;
}

export function toPublicStatusHistoryEntry(entry: EmployeeStatusHistoryEntity): PublicStatusHistoryEntry {
  return {
    id: entry.id,
    statusName: entry.statusName,
    statusColor: entry.statusColor ?? null,
    automatic: entry.automatic,
    createdAt: entry.createdAt,
  };
}
