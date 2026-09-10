import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecentActivityState {
  // Plain string[] rather than a Set — Set doesn't round-trip through
  // JSON.stringify (zustand's persist middleware would silently serialize
  // it to `{}`), so array + includes()/filter() is the simplest thing that
  // actually survives a page reload.
  activeTicketIds: string[];
  markActive: (ticketId: string) => void;
  clear: (ticketId: string) => void;
  // Not user-scoped in storage — same leak class already fixed once on this
  // store's sibling, sidebar-highlight.store.ts: without this, operator A's
  // "recent activity" dots inherit onto operator B's session on a shared
  // workstation, since logging out never used to clear it. Call on logout.
  clearAll: () => void;
}

export const useRecentActivityStore = create<RecentActivityState>()(
  persist(
    (set) => ({
      activeTicketIds: [],
      markActive: (ticketId) =>
        set((state) =>
          state.activeTicketIds.includes(ticketId)
            ? state
            : { activeTicketIds: [...state.activeTicketIds, ticketId] },
        ),
      clear: (ticketId) =>
        set((state) => ({ activeTicketIds: state.activeTicketIds.filter((id) => id !== ticketId) })),
      clearAll: () => set({ activeTicketIds: [] }),
    }),
    { name: 'veloxdesk-recent-activity' },
  ),
);
