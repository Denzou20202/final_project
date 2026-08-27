import type { PublicUser } from './types.js';

// The one place that decides who may be OFFERED as a ticket assignee —
// mirrors the backend's assign() validation exactly (client → 400,
// deactivated → 404, «наблюдатель»-group member → 400), so no picker ever
// offers a choice the server would reject.
export function isAssignableStaff(user: PublicUser): boolean {
  return user.role !== 'client' && !user.deactivatedAt && user.canBeAssignee;
}
