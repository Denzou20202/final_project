import { useMemo } from 'react';
import type { UserRole } from '../lib/types.js';
import { useAssignableUsers } from './useUsers.js';

export function useUserLookup() {
  const { data } = useAssignableUsers();

  return useMemo(() => {
    const map = new Map<string, string>();
    for (const user of data?.items ?? []) {
      map.set(user.id, user.fullName);
    }
    return (id: string | null | undefined) => (id ? (map.get(id) ?? '—') : '—');
  }, [data]);
}

// Separate from useUserLookup (name-only) rather than changing its return
// shape — that function has four call sites that only ever want the name.
export function useUserRoleLookup() {
  const { data } = useAssignableUsers();

  return useMemo(() => {
    const map = new Map<string, UserRole>();
    for (const user of data?.items ?? []) {
      map.set(user.id, user.role);
    }
    return (id: string | null | undefined): UserRole | undefined => (id ? map.get(id) : undefined);
  }, [data]);
}

// Feeds the VIP sheriff-star badge (VipBadge) next to a client's name in
// spots — like TicketsPage's ticket-list rows — that only have the id, not
// the full PublicUser object already resolved (unlike TicketActionsPanel/
// CreateTicketModal, which look isVip up directly on the object they have).
export function useUserVipLookup() {
  const { data } = useAssignableUsers();

  return useMemo(() => {
    const map = new Map<string, boolean>();
    for (const user of data?.items ?? []) {
      map.set(user.id, user.isVip);
    }
    return (id: string | null | undefined): boolean => (id ? (map.get(id) ?? false) : false);
  }, [data]);
}
