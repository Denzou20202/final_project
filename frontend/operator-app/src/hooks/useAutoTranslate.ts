import { useEffect, useRef } from 'react';
import { ticketApi } from '../lib/api/client.js';

// Debounced RU->UK/EN auto-fill for the 8 admin catalog forms (ticket
// statuses, custom fields, macros, articles, teams, tags, categories,
// employee statuses) — 500ms after `sourceText` stops changing, calls the
// generic /translate endpoint (hosted in ticket-service regardless of which
// entity the caller is actually editing) and hands the result to `onResult`
// for the caller to fill into its own uk/en form fields. `enabled` lets a
// caller skip firing entirely — used for an existing row whose uk/en the
// admin has already hand-edited, so a later RU tweak doesn't clobber a
// deliberate correction. Never throws: a DeepL/network failure just means
// onResult is never called for that keystroke, same as an unconfigured
// DEEPL_API_KEY (the endpoint itself degrades to {uk: null, en: null} and
// this hook only calls onResult for a non-null value — see the callers).
export function useAutoTranslate(
  sourceText: string,
  enabled: boolean,
  onResult: (uk: string | null, en: string | null) => void,
) {
  const lastRequestedRef = useRef(sourceText);

  useEffect(() => {
    if (!enabled) return;
    const trimmed = sourceText.trim();
    if (!trimmed || trimmed === lastRequestedRef.current) return;

    // `enabled` flipping to false (the admin hand-editing uk/en, which sets
    // the caller's ukEnTouched) re-runs this effect with a fresh closure —
    // it does NOT cancel a request already in flight from the PREVIOUS run.
    // That old .then() still holds the OLD (stale) `enabled`/`onResult`
    // closure, so checking `enabled` again inside it wouldn't help; this
    // flag is what actually gets set by THIS run's own cleanup, whether
    // that runs because of ukEnTouched, another keystroke superseding this
    // request, or unmount — closing the window where a slow response lands
    // after the admin already typed a manual correction, or a stale
    // response from an earlier keystroke resolves after a newer one.
    let cancelled = false;
    const timer = setTimeout(() => {
      lastRequestedRef.current = trimmed;
      ticketApi
        .post<{ uk: string | null; en: string | null }>('/translate', { text: trimmed })
        .then(({ data }) => {
          if (!cancelled) onResult(data.uk, data.en);
        })
        .catch(() => {
          // Network/DeepL failure — leave the uk/en fields exactly as they
          // were; the admin can always type them in by hand.
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sourceText, enabled, onResult]);
}
