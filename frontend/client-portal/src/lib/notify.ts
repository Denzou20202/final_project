// No bundled audio asset — a short synthesized beep via Web Audio avoids
// shipping/loading a binary file just for a one-off notification chime, and
// sounds identical every time regardless of network conditions.
export function playNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.35);
    oscillator.onended = () => void ctx.close();
  } catch {
    // Autoplay restrictions or an unsupported browser — a missed chime
    // isn't worth surfacing an error over.
  }
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showNotification(title: string, body: string): void {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  try {
    // No icon option — unlike operator-app (a PWA with pwa-*.png assets),
    // client-portal isn't a PWA and only has favicon.svg; browsers fall
    // back to their own default notification icon just fine.
    new Notification(title, { body });
  } catch {
    // Some browsers throw when called outside a service-worker context in
    // certain embeddings — a missed notification isn't worth crashing over.
  }
}
