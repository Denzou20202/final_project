import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarDepartmentsState {
  // Absent from this list = visible (default) — a department created after
  // the user last touched the filter shows up automatically instead of
  // silently staying hidden.
  hiddenTeamIds: string[];
  toggleHidden: (teamId: string) => void;
  reset: () => void;
}

// Per-person «which departments do I want cluttering my sidebar» — purely
// presentational and local to this browser, same reasoning as
// ticket-table.store.ts's column preferences.
export const useSidebarDepartmentsStore = create<SidebarDepartmentsState>()(
  persist(
    (set) => ({
      hiddenTeamIds: [],
      toggleHidden: (teamId) =>
        set((state) => ({
          hiddenTeamIds: state.hiddenTeamIds.includes(teamId)
            ? state.hiddenTeamIds.filter((id) => id !== teamId)
            : [...state.hiddenTeamIds, teamId],
        })),
      reset: () => set({ hiddenTeamIds: [] }),
    }),
    { name: 'veloxdesk-sidebar-departments' },
  ),
);
