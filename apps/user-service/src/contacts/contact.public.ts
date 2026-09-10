import type { PublicUser } from '../users/user.public.js';

export type DuplicateMatchSignal = 'email' | 'phone' | 'name';

export interface PublicDuplicateGroup {
  // Stable only for the lifetime of one findDuplicateGroups() response — one
  // member's id, just enough to key a React list. Not a stored id.
  groupId: string;
  matchedOn: DuplicateMatchSignal[];
  contacts: PublicUser[];
}
