import { resolveStatusIdParam, statusUrlPosition } from './status-url.js';
import type { PublicTicketStatus } from './types.js';

function status(id: string, sortOrder: number): PublicTicketStatus {
  return {
    id,
    key: null,
    name: id,
    nameUk: id,
    nameEn: id,
    color: '#000000',
    isDefault: false,
    isClosed: false,
    tracksSla: true,
    sortOrder,
  } as PublicTicketStatus;
}

const STATUSES = [status('a', 1), status('b', 2), status('c', 3)];

describe('statusUrlPosition', () => {
  it('returns the 1-based index of a known status', () => {
    expect(statusUrlPosition('a', STATUSES)).toBe(1);
    expect(statusUrlPosition('c', STATUSES)).toBe(3);
  });

  it('returns undefined for an unknown status id', () => {
    expect(statusUrlPosition('unknown', STATUSES)).toBeUndefined();
  });

  it('returns undefined when the statuses list is not loaded yet', () => {
    expect(statusUrlPosition('a', undefined)).toBeUndefined();
  });
});

describe('resolveStatusIdParam', () => {
  it('resolves a numeric position to the real status id', () => {
    expect(resolveStatusIdParam('1', STATUSES)).toBe('a');
    expect(resolveStatusIdParam('3', STATUSES)).toBe('c');
  });

  it('returns null for a position out of range', () => {
    expect(resolveStatusIdParam('99', STATUSES)).toBeNull();
    expect(resolveStatusIdParam('0', STATUSES)).toBeNull();
  });

  it('passes through a non-numeric value as-is (legacy uuid format)', () => {
    expect(resolveStatusIdParam('00000000-0000-4000-8000-000000000101', STATUSES)).toBe(
      '00000000-0000-4000-8000-000000000101',
    );
  });

  it('returns null for a missing param', () => {
    expect(resolveStatusIdParam(null, STATUSES)).toBeNull();
  });

  it('returns null for an out-of-range position when statuses are not loaded yet', () => {
    expect(resolveStatusIdParam('1', undefined)).toBeNull();
  });
});
