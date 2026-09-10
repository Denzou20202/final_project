import { isIpAllowed } from './ip-cidr-match.js';

describe('isIpAllowed', () => {
  it('allows any IP when the whitelist is empty', () => {
    expect(isIpAllowed('8.8.8.8', [])).toBe(true);
  });

  it('matches a bare IP as an implicit /32', () => {
    expect(isIpAllowed('198.51.100.42', ['198.51.100.42'])).toBe(true);
    expect(isIpAllowed('198.51.100.43', ['198.51.100.42'])).toBe(false);
  });

  it('matches within a /24 range', () => {
    expect(isIpAllowed('203.0.113.17', ['203.0.113.0/24'])).toBe(true);
    expect(isIpAllowed('203.0.114.17', ['203.0.113.0/24'])).toBe(false);
  });

  it('matches a /0 range against anything valid', () => {
    expect(isIpAllowed('1.2.3.4', ['0.0.0.0/0'])).toBe(true);
  });

  it('matches across multiple ranges (any match wins)', () => {
    const ranges = ['10.0.0.0/8', '203.0.113.0/24'];
    expect(isIpAllowed('10.5.5.5', ranges)).toBe(true);
    expect(isIpAllowed('203.0.113.200', ranges)).toBe(true);
    expect(isIpAllowed('172.16.0.1', ranges)).toBe(false);
  });

  it('respects octet-aligned prefix boundaries precisely', () => {
    // 192.168.1.0/25 covers .0-.127, not .128-.255
    expect(isIpAllowed('192.168.1.100', ['192.168.1.0/25'])).toBe(true);
    expect(isIpAllowed('192.168.1.200', ['192.168.1.0/25'])).toBe(false);
  });

  it('normalizes IPv4-mapped IPv6 addresses before matching', () => {
    expect(isIpAllowed('::ffff:203.0.113.17', ['203.0.113.0/24'])).toBe(true);
  });

  it('fails closed on a malformed stored range instead of throwing', () => {
    expect(() => isIpAllowed('203.0.113.17', ['not-a-cidr'])).not.toThrow();
    expect(isIpAllowed('203.0.113.17', ['not-a-cidr'])).toBe(false);
  });

  it('fails closed on a trailing slash — never treats "x/" as an allow-everything /0', () => {
    expect(isIpAllowed('8.8.8.8', ['1.2.3.4/'])).toBe(false);
  });

  it('fails closed on a non-numeric or doubled prefix', () => {
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4/ab'])).toBe(false);
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4/24/8'])).toBe(false);
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4/33'])).toBe(false);
  });

  it('rejects an unparsable request IP', () => {
    expect(isIpAllowed('not-an-ip', ['0.0.0.0/0'])).toBe(false);
  });

  it('rejects out-of-range octets', () => {
    expect(isIpAllowed('999.1.1.1', ['0.0.0.0/0'])).toBe(false);
  });
});
