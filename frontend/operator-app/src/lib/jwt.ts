// Plain decode, no signature verification — this is our OWN already-issued
// access token (already validated server-side on every real API call), read
// here only to drive a client-side UX decision (see staff-visibility.ts),
// never as a security boundary. A malformed/foreign token just yields null.
export interface DecodedJwtPayload {
  sub: string;
  role: string;
  restrictToDepartments?: boolean;
  departmentIds?: string[];
  restrictToOwnTickets?: boolean;
}

export function decodeJwtPayload(token: string): DecodedJwtPayload | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    // atob() requires standard base64 padding — JWT's base64url segments
    // omit it, so pad back out to a multiple of 4 before decoding.
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as DecodedJwtPayload;
  } catch {
    return null;
  }
}
