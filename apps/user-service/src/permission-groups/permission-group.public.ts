import { PermissionGroupEntity } from '@veloxdesk/database';

export interface PublicPermissionGroup {
  id: string;
  name: string;
  restrictToDepartments: boolean;
  departmentIds: string[];
  restrictToOwnTickets: boolean;
  cannotBeAssignee: boolean;
  canViewReports: boolean;
  canExportReports: boolean;
  requireTwoFactor: boolean;
  ipWhitelist: string[];
  memberCount: number;
  createdAt: Date;
}

export function toPublicPermissionGroup(
  group: PermissionGroupEntity,
  departmentIds: string[] = [],
  memberCount = 0,
): PublicPermissionGroup {
  return {
    id: group.id,
    name: group.name,
    restrictToDepartments: group.restrictToDepartments,
    departmentIds,
    restrictToOwnTickets: group.restrictToOwnTickets,
    cannotBeAssignee: group.cannotBeAssignee,
    canViewReports: group.canViewReports ?? true,
    canExportReports: group.canExportReports ?? true,
    requireTwoFactor: group.requireTwoFactor,
    ipWhitelist: group.ipWhitelist,
    memberCount,
    createdAt: group.createdAt,
  };
}
