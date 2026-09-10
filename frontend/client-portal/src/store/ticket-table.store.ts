import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// A client's own ticket list is typically far smaller than an operator's
// queue — smaller page sizes than operator-app's PAGE_SIZE_OPTIONS
// (25-250) make more sense here.
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const TICKET_COLUMN_KEYS = ['number', 'title', 'status', 'priority', 'createdAt'] as const;
export type TicketColumnKey = (typeof TICKET_COLUMN_KEYS)[number];

interface TicketTableState {
  // Column display order — always a permutation of TICKET_COLUMN_KEYS.
  order: TicketColumnKey[];
  pageSize: PageSize;
  move: (key: TicketColumnKey, direction: -1 | 1) => void;
  setPageSize: (size: PageSize) => void;
  reset: () => void;
}

// Per-client list-view preferences (column order, page size) — purely
// presentational, so localStorage is the right home. Mirrors operator-app's
// ticket-table.store.ts, minus hide/resize (not offered here, only reorder).
export const useTicketTableStore = create<TicketTableState>()(
  persist(
    (set) => ({
      order: [...TICKET_COLUMN_KEYS],
      pageSize: 25,
      move: (key, direction) =>
        set((state) => {
          const order = [...state.order];
          const from = order.indexOf(key);
          const to = from + direction;
          if (from === -1 || to < 0 || to >= order.length) return state;
          order.splice(from, 1);
          order.splice(to, 0, key);
          return { order };
        }),
      setPageSize: (size) => set({ pageSize: size }),
      reset: () => set({ order: [...TICKET_COLUMN_KEYS], pageSize: 25 }),
    }),
    {
      name: 'veloxdesk-client-ticket-table',
      // A column added in a future release must appear for users with an
      // older persisted order — merge missing keys back in on rehydrate.
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<TicketTableState>) };
        const known = new Set(state.order);
        state.order = [
          ...state.order.filter((k) => TICKET_COLUMN_KEYS.includes(k)),
          ...TICKET_COLUMN_KEYS.filter((k) => !known.has(k)),
        ];
        return state;
      },
    },
  ),
);
