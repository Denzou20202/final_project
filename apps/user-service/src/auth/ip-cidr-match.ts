// IPv4 CIDR matcher — no external dependency, mirrors the style of
// calc-formula.ts (hand-written instead of pulling in a library for
// something this small and security-sensitive to get exactly right).

function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

// A single "203.0.113.0/24" or bare "198.51.100.42" (implicit /32) range.
// The prefix must be an explicit 1-2 digit number — a bare trailing slash
// ("1.2.3.4/") must NOT fall through Number('') === 0 into an
// allow-everything /0, and a doubled slash is malformed outright. The DTO
// regex already rejects both at the API boundary; this keeps the matcher
// itself fail-closed even against a value that reached the DB another way.
function matchesRange(ipInt: number, range: string): boolean {
  const parts = range.trim().split('/');
  if (parts.length > 2) return false;
  const [rangeAddr, prefixStr] = parts;
  if (prefixStr !== undefined && !/^\d{1,2}$/.test(prefixStr)) return false;
  const prefix = prefixStr === undefined ? 32 : Number(prefixStr);
  if (prefix > 32) return false;

  const rangeInt = ipToInt(rangeAddr);
  if (rangeInt === null) return false;

  if (prefix === 0) return true;
  const mask = prefix === 32 ? 0xffffffff : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) >>> 0 === (rangeInt & mask) >>> 0;
}

// Normalizes the common "::ffff:a.b.c.d" IPv4-mapped-IPv6 form that
// Express/Node sometimes reports for IPv4 connections — everything else
// (real IPv6) simply won't match any IPv4 range, which is the correct
// "not allowed" outcome for an IPv4-only whitelist.
function normalizeIp(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  return mapped ? mapped[1] : ip;
}

// Empty whitelist = not restricted. A malformed stored range never matches
// (fails closed for that one entry, not open) rather than throwing.
export function isIpAllowed(ip: string, ranges: string[]): boolean {
  if (ranges.length === 0) return true;
  const ipInt = ipToInt(normalizeIp(ip));
  if (ipInt === null) return false;
  return ranges.some((range) => matchesRange(ipInt, range));
}
