import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TicketFilterPreset {
  id: string;
  name: string;
  // The raw ticket-list query string (searchParams.toString()) — applying a
  // preset is just navigating to `/tickets?${search}`, a full replace of
  // whatever filters are currently active (same as clicking a sidebar tag or
  // status folder), not a merge.
  search: string;
}

interface TicketFilterPresetsState {
  presets: TicketFilterPreset[];
  addPreset: (name: string, search: string) => void;
  removePreset: (id: string) => void;
}

// Per-operator saved filter combinations — same reasoning as
// ticket-table.store.ts's column preferences: purely presentational
// shortcuts to a query string, not real data, so localStorage is the right
// home (no server round-trip, survives reloads, never leaves this browser).
export const useTicketFilterPresetsStore = create<TicketFilterPresetsState>()(
  persist(
    (set) => ({
      presets: [],
      addPreset: (name, search) =>
        set((state) => ({
          presets: [...state.presets, { id: crypto.randomUUID(), name, search }],
        })),
      removePreset: (id) =>
        set((state) => ({ presets: state.presets.filter((p) => p.id !== id) })),
    }),
    { name: 'veloxdesk-filter-presets' },
  ),
);
