import { Locale } from '@veloxdesk/types';
import { BOT_STRINGS } from './bot-strings.js';

describe('BOT_STRINGS', () => {
  // Belt-and-suspenders runtime check alongside the compile-time guarantee
  // BotStrings's shared interface already gives (a missing key across
  // locales is a TS error) — this instead catches a key that exists on all
  // three locales but was accidentally left an empty string via a
  // copy-paste, which the type system can't see.
  it('has the exact same set of non-empty keys across all three locales', () => {
    const [ru, uk, en] = [Locale.RU, Locale.UK, Locale.EN].map((locale) => BOT_STRINGS[locale]);
    const ruKeys = Object.keys(ru).sort();

    expect(Object.keys(uk).sort()).toEqual(ruKeys);
    expect(Object.keys(en).sort()).toEqual(ruKeys);

    const emptyStringKeys: string[] = [];
    for (const key of ruKeys) {
      for (const [locale, dict] of [
        ['ru', ru],
        ['uk', uk],
        ['en', en],
      ] as const) {
        const value = dict[key as keyof typeof dict];
        if (value === '') {
          emptyStringKeys.push(`${locale}.${key}`);
        }
      }
    }
    expect(emptyStringKeys).toEqual([]);
  });
});
