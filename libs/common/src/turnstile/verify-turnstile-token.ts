// Thin wrapper over Cloudflare Turnstile's siteverify endpoint — shared by
// user-service's registration (always required) and login (required once
// LoginLockoutService's failure counter for an IP crosses its threshold).
// Uses Node's native global fetch, same as the Telegram helpers in this
// same lib — no HTTP client dependency exists in user-service, and none is
// needed for a single form-encoded POST.
//
// Fails CLOSED on any network/parse error (returns false, "not verified")
// rather than the fail-open pattern the rest of this codebase uses for
// best-effort side effects (Telegram notifications, search reindexing,
// ...). Those are all "a blip here loses a nice-to-have, not the actual
// write" — this is the opposite: it IS the security check, and treating a
// Cloudflare hiccup as "let it through" would silently turn a captcha
// requirement into a no-op for the exact duration it's most likely to
// matter (a provider outage is itself the kind of anomaly worth being
// conservative around). Cloudflare's edge network is far more reliable
// than anything self-hosted in this stack, so this should be rare in
// practice.
export async function verifyTurnstileToken(secretKey: string, token: string, remoteIp?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
