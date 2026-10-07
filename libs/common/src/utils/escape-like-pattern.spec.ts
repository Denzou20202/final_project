import { escapeLikePattern } from './escape-like-pattern.js';

describe('escapeLikePattern', () => {
  it('escapes % and _ and backslash', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('tag_name')).toBe('tag\\_name');
    expect(escapeLikePattern('tag\\name')).toBe('tag\\\\name');
    expect(escapeLikePattern('100%_safe\\pattern')).toBe('100\\%\\_safe\\\\pattern');
  });

  it('leaves standard characters unchanged', () => {
    expect(escapeLikePattern('standard-tag-123')).toBe('standard-tag-123');
  });
});
