import { useEffect, useRef } from 'react';
import { getChatSocket } from '../lib/socket.js';
import { usePresenceSettings } from './useEmployeeStatuses.js';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;
// Real user input fires far more often than the idle threshold needs —
// this just bounds how often the timer gets reset, not the detection itself.
const THROTTLE_MS = 5_000;

// The server has no visibility into whether a connected tab is actually
// being looked at, so idle detection is client-driven: this hook watches
// real input and reports crossing the admin-configured threshold over the
// socket (see EmployeeStatusService.setIdle/setActive on chat-service).
// Mounted once for the whole staff app (in Sidebar, always present while
// authenticated) rather than per-page.
export function useIdleReporter(): void {
  const { data: settings } = usePresenceSettings();
  const thresholdMinutes = settings?.inactivityTimeoutMinutes ?? 15;
  const isIdleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(0);

  useEffect(() => {
    const thresholdMs = thresholdMinutes * 60_000;
    const socket = getChatSocket();

    function goIdle() {
      if (isIdleRef.current) return;
      isIdleRef.current = true;
      socket.emit('presence:idle');
    }

    function restartTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(goIdle, thresholdMs);
    }

    function handleActivity() {
      const now = Date.now();
      if (now - lastActivityRef.current < THROTTLE_MS) return;
      lastActivityRef.current = now;
      if (isIdleRef.current) {
        isIdleRef.current = false;
        socket.emit('presence:active');
      }
      restartTimer();
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', handleActivity);
    restartTimer();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [thresholdMinutes]);
}
