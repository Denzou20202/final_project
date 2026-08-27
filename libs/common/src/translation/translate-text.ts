// Thin wrapper over DeepL's free-tier REST API — mirrors send-telegram
// -message.ts's shape (a plain function using native fetch, no HTTP client
// dependency, no injectable wrapper class; the caller passes the API key in
// rather than this reading it via DI, so libs/common stays framework-
// agnostic). Backs the admin-catalog auto-translate feature: when an admin
// creates/edits a ticket status/custom field/macro/article/team/tag/
// category/employee status, the UK/EN name variants are auto-filled from
// this, editable before the admin saves. Deliberately never throws — a
// DeepL outage, an unconfigured/invalid key, or a quota-exceeded response
// must never block an admin from saving; the caller just leaves those two
// fields blank for the admin to type by hand instead.
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

export interface DeepLTranslateResult {
  uk: string | null;
  en: string | null;
}

async function translateOne(apiKey: string, text: string, targetLang: 'UK' | 'EN'): Promise<string | null> {
  try {
    const res = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `DeepL-Auth-Key ${apiKey}` },
      body: JSON.stringify({ text: [text], source_lang: 'RU', target_lang: targetLang }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { translations?: { text: string }[] };
    return body.translations?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

export async function translateRuToUkEn(apiKey: string, text: string): Promise<DeepLTranslateResult> {
  const [uk, en] = await Promise.all([translateOne(apiKey, text, 'UK'), translateOne(apiKey, text, 'EN')]);
  return { uk, en };
}
