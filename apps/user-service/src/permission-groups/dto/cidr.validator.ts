// IPv4 CIDR only (e.g. "203.0.113.0/24" or a bare "198.51.100.42") — matches
// the format the ip-cidr-match.ts matcher (Phase 2) accepts. Octet-range
// checked here too so an obviously malformed entry ("999.1.1.1/24") is
// rejected at the DTO boundary, not silently stored.
const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
export const CIDR_REGEX = new RegExp(`^(${OCTET}\\.){3}${OCTET}(\\/(3[0-2]|[12]?\\d))?$`);
