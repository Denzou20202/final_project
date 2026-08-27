import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationPreferencesState {
  soundEnabled: boolean;
  pushEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setPushEnabled: (enabled: boolean) => void;
}

// Sound defaults on (low-friction, no permission prompt); push defaults off
// since enabling it triggers a real browser permission dialog — a client
// should opt in deliberately rather than be surprised by it on first login.
export const useNotificationPreferencesStore = create<NotificationPreferencesState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      pushEnabled: false,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setPushEnabled: (pushEnabled) => set({ pushEnabled }),
    }),
    { name: 'veloxdesk-notification-preferences' },
  ),
);
