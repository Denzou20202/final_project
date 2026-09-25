import { computeSlaPauseUpdate } from './tickets.service.js';

describe('computeSlaPauseUpdate', () => {
  it('sets slaPausedAt when moving to an untracked non-closed status for the first time', () => {
    const before = Date.now();
    const result = computeSlaPauseUpdate(
      { pausedDurationMin: 0, slaPausedAt: null },
      { tracksSla: false, isClosed: false },
    );

    expect(result.pausedDurationMin).toBe(0);
    expect(result.slaPausedAt).toBeInstanceOf(Date);
    expect(result.slaPausedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('preserves existing slaPausedAt when staying in an untracked status', () => {
    const past = new Date(Date.now() - 30 * 60_000);
    const result = computeSlaPauseUpdate(
      { pausedDurationMin: 15, slaPausedAt: past },
      { tracksSla: false, isClosed: false },
    );

    expect(result.pausedDurationMin).toBe(15);
    expect(result.slaPausedAt).toEqual(past);
  });

  it('accumulates elapsed minutes and clears slaPausedAt when moving back to tracked status', () => {
    const past = new Date(Date.now() - 45 * 60_000);
    const result = computeSlaPauseUpdate(
      { pausedDurationMin: 10, slaPausedAt: past },
      { tracksSla: true, isClosed: false },
    );

    expect(result.pausedDurationMin).toBeCloseTo(55, -1);
    expect(result.slaPausedAt).toBeNull();
  });

  it('finalizes paused duration when moving to a closed status', () => {
    const past = new Date(Date.now() - 20 * 60_000);
    const result = computeSlaPauseUpdate(
      { pausedDurationMin: 5, slaPausedAt: past },
      { tracksSla: false, isClosed: true },
    );

    expect(result.pausedDurationMin).toBeCloseTo(25, -1);
    expect(result.slaPausedAt).toBeNull();
  });
});
