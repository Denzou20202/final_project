import { extractThreadCandidates } from './thread-matching.js';

describe('extractThreadCandidates', () => {
  it('returns an empty array when the message starts a new thread', () => {
    expect(extractThreadCandidates(undefined, undefined)).toEqual([]);
  });

  it('includes the In-Reply-To header', () => {
    expect(extractThreadCandidates('<msg1@mail>', undefined)).toEqual(['<msg1@mail>']);
  });

  it('splits a whitespace-separated References header', () => {
    expect(extractThreadCandidates(undefined, '<msg1@mail> <msg2@mail>')).toEqual(['<msg1@mail>', '<msg2@mail>']);
  });

  it('accepts References already parsed as an array', () => {
    expect(extractThreadCandidates(undefined, ['<msg1@mail>', '<msg2@mail>'])).toEqual(['<msg1@mail>', '<msg2@mail>']);
  });

  it('deduplicates when In-Reply-To also appears in References', () => {
    expect(extractThreadCandidates('<msg2@mail>', '<msg1@mail> <msg2@mail>')).toEqual(['<msg2@mail>', '<msg1@mail>']);
  });
});
