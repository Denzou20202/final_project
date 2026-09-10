import { UserRole } from '@veloxdesk/types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  // Snapshot of the actor's permission group (if any), computed once at
  // login/refresh — mirrors how `role` already works: a later admin change
  // to the group only takes effect on this user's next token issuance, not
  // mid-session. Absent entirely when the user has no group, meaning
  // "unrestricted" (same behavior as before this feature existed).
  permissionGroupId?: string;
  restrictToDepartments?: boolean;
  // Group's base department list ∪ the user's personal extra departments,
  // already unioned and deduplicated at issuance time.
  departmentIds?: string[];
  restrictToOwnTickets?: boolean;
  cannotBeAssignee?: boolean;
}
