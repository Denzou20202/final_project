import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';
export type DesignTheme = 'contrast' | 'warm' | 'cyber' | 'forest' | 'sunset' | 'slate' | 'classic';

interface ThemeState {
  theme: Theme;
  designTheme: DesignTheme;
  toggle: () => void;
  setDesignTheme: (t: DesignTheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      designTheme: 'contrast',
      toggle: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setDesignTheme: (t) => set({ designTheme: t }),
    }),
    { name: 'veloxdesk-theme' },
  ),
);

// The `dark` class on <html> is the single switch every color token keys
// off (tailwind darkMode: 'class' + the .dark variable block in styles.css).
// Applied as a module side effect so the very first paint — including the
// login page, where no themed component is mounted yet — already uses the
// persisted choice instead of flashing light.
function applyTheme(theme: Theme, designTheme: DesignTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.setAttribute('data-theme', designTheme);
}

applyTheme(useThemeStore.getState().theme, useThemeStore.getState().designTheme);
useThemeStore.subscribe((state) => applyTheme(state.theme, state.designTheme));
