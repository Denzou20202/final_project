import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// A ticket_statuses row id, or the synthetic 'unassigned' folder.
type FolderKey = string | 'unassigned';

interface SidebarHighlightState {
  // Per-ticket folder membership for every ticket with unseen activity —
  // keyed by ticket id, not just a flat set of "dirty" folders. A flat set
  // can only ever grow: when a ticket moves to a new folder (status change,
  // getting assigned), there was no record of which folder it used to
  // belong to, so the OLD folder stayed highlighted forever even after the
  // ticket left it. Keying by ticket id lets that same ticket's next event
  // overwrite its own entry, evicting the stale folder automatically.
  // Plain object, not Map — Map doesn't survive zustand persist's JSON
  // round-trip either (same reason activeStatuses below is a plain array,
  // not a Set). Mirrors operator-app's copy of this store exactly.
  activeTickets: Record<string, FolderKey>;
  // Derived from activeTickets on every mutation below, and kept as real
  // state (not a computed selector) so Sidebar.tsx's existing selectors
  // don't need to change.
  activeStatuses: string[];
  unassignedActive: boolean;
  markActive: (ticketId: string, statusId: string) => void;
  markUnassignedActive: (ticketId: string) => void;
  clear: (statusId: string) => void;
  clearUnassigned: () => void;
  // Removes one ticket's entry regardless of which folder it's in — used
  // when the user actually opens/replies to that specific ticket, so it
  // doesn't blow away OTHER tickets' legitimate unseen-activity highlight
  // still sitting in the same folder the way clear(status) would.
  clearTicket: (ticketId: string) => void;
  // Not user-scoped in storage — must be wiped on logout, or the next
  // person to log in on this browser inherits the previous client's
  // highlighted folders.
  clearAll: () => void;
}

function deriveFolders(
  activeTickets: Record<string, FolderKey>,
): Pick<SidebarHighlightState, 'activeStatuses' | 'unassignedActive'> {
  const activeStatuses: string[] = [];
  let unassignedActive = false;
  for (const folder of Object.values(activeTickets)) {
    if (folder === 'unassigned') unassignedActive = true;
    else if (!activeStatuses.includes(folder)) activeStatuses.push(folder);
  }
  return { activeStatuses, unassignedActive };
}

export const useSidebarHighlightStore = create<SidebarHighlightState>()(
  persist(
    (set) => ({
      activeTickets: {},
      activeStatuses: [],
      unassignedActive: false,
      markActive: (ticketId, statusId) =>
        set((state) => {
          const activeTickets = { ...state.activeTickets, [ticketId]: statusId };
          return { activeTickets, ...deriveFolders(activeTickets) };
        }),
      markUnassignedActive: (ticketId) =>
        set((state) => {
          const activeTickets = { ...state.activeTickets, [ticketId]: 'unassigned' as const };
          return { activeTickets, ...deriveFolders(activeTickets) };
        }),
      clear: (statusId) =>
        set((state) => {
          const activeTickets = Object.fromEntries(
            Object.entries(state.activeTickets).filter(([, folder]) => folder !== statusId),
          );
          return { activeTickets, ...deriveFolders(activeTickets) };
        }),
      clearUnassigned: () =>
        set((state) => {
          const activeTickets = Object.fromEntries(
            Object.entries(state.activeTickets).filter(([, folder]) => folder !== 'unassigned'),
          );
          return { activeTickets, ...deriveFolders(activeTickets) };
        }),
      clearTicket: (ticketId) =>
        set((state) => {
          if (!(ticketId in state.activeTickets)) return state;
          const activeTickets = { ...state.activeTickets };
          delete activeTickets[ticketId];
          return { activeTickets, ...deriveFolders(activeTickets) };
        }),
      clearAll: () => set({ activeTickets: {}, activeStatuses: [], unassignedActive: false }),
    }),
    { name: 'veloxdesk-sidebar-highlight' },
  ),
);
