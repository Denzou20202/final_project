import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 150, 200, 250] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const TICKET_COLUMN_KEYS = [
  'number',
  'title',
  'client',
  'assignee',
  'team',
  'sla',
  'status',
  'priority',
  'createdAt',
] as const;
export type TicketColumnKey = (typeof TICKET_COLUMN_KEYS)[number];

interface TicketTableState {
  // Column display order — always a permutation of TICKET_COLUMN_KEYS.
  order: TicketColumnKey[];
  hidden: Partial<Record<TicketColumnKey, boolean>>;
  widths: Partial<Record<TicketColumnKey, number>>;
  pageSize: PageSize;
  toggleHidden: (key: TicketColumnKey) => void;
  move: (key: TicketColumnKey, direction: -1 | 1) => void;
  setWidth: (key: TicketColumnKey, width: number) => void;
  setPageSize: (size: PageSize) => void;
  reset: () => void;
}

// Per-operator list-view preferences (which columns, in what order, how
// wide) — purely presentational, so localStorage is the right home: no
// server round-trip, survives reloads, never leaves this browser.
export const useTicketTableStore = create<TicketTableState>()(
  persist(
    (set) => ({
      order: [...TICKET_COLUMN_KEYS],
      hidden: {},
      widths: {},
      pageSize: 25,
      toggleHidden: (key) =>
        set((state) => ({ hidden: { ...state.hidden, [key]: !state.hidden[key] } })),
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
      setWidth: (key, width) =>
        set((state) => ({ widths: { ...state.widths, [key]: Math.round(width) } })),
      setPageSize: (size) => set({ pageSize: size }),
      reset: () => set({ order: [...TICKET_COLUMN_KEYS], hidden: {}, widths: {}, pageSize: 25 }),
    }),
    {
      name: 'veloxdesk-ticket-table',
      // A column added in a future release must appear for users with an
      // older persisted order — merge missing keys back in on rehydrate.
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<TicketTableState>) };
        const known = new Set(state.order);
        state.order = [...state.order.filter((k) => TICKET_COLUMN_KEYS.includes(k)), ...TICKET_COLUMN_KEYS.filter((k) => !known.has(k))];
        return state;
      },
    },
  ),
);
