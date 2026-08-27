// A reply email references the thread it belongs to via In-Reply-To (the
// immediate parent) and References (the full chain). Either can match a
// ticket's stored external_thread_id, so we check both.
export function extractThreadCandidates(inReplyTo?: string, references?: string | string[]): string[] {
  const ids = new Set<string>();

  if (inReplyTo?.trim()) {
    ids.add(inReplyTo.trim());
  }

  if (references) {
    const refs = Array.isArray(references) ? references : references.split(/\s+/);
    for (const ref of refs) {
      if (ref.trim()) {
        ids.add(ref.trim());
      }
    }
  }

  return [...ids];
}
