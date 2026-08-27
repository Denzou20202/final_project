import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserSearch } from '../../hooks/useUsers.js';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

// Replaces a plain <select> populated from the capped (~100-row) client
// list ReportFiltersForm otherwise derives from useAssignableUsers — with
// 1000+ real clients, that list can only ever offer whichever accounts
// happen to land on the first createdAt-ordered page, making almost every
// client unreachable as a report filter. This searches server-side
// instead (see searchUsers/useUserSearch), same debounce shape as the
// ticket list's own search box.
export function ClientSearchSelect({ value, onChange }: { value: string; onChange: (clientId: string) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  // Only ever knows a name for a client picked THROUGH this component —
  // a value set externally (e.g. reloading a saved report's clientId) has
  // no name to resolve without a GET /users/:id endpoint, which doesn't
  // exist. Falls back to a generic "selected" label in that case rather
  // than showing nothing, same class of gap the saved-report-reload finding
  // already flagged as a separate, lower-priority issue.
  const [selectedLabel, setSelectedLabel] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
      setQuery('');
    }
  }, [value]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const trimmedQuery = debouncedQuery.trim();
  const { data, isFetching } = useUserSearch(trimmedQuery, isOpen && trimmedQuery.length >= MIN_QUERY_LENGTH);
  const results = (data?.items ?? []).filter((u) => u.role === 'client');

  function select(user: { id: string; fullName: string }) {
    onChange(user.id);
    setSelectedLabel(user.fullName);
    setQuery('');
    setIsOpen(false);
  }

  function clear() {
    onChange('');
    setSelectedLabel('');
    setQuery('');
  }

  const displayValue = isOpen ? query : selectedLabel || (value ? t('reports.clientSelected') : '');

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={t('reports.searchClientPlaceholder')}
        className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
      />
      {value && !isOpen && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
          aria-label={t('reports.clearClient')}
        >
          ×
        </button>
      )}
      {isOpen && trimmedQuery.length >= MIN_QUERY_LENGTH && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface-card py-1 shadow-lg">
          {isFetching && <div className="px-3 py-1.5 text-[12.5px] text-ink-faint">{t('common.loading')}</div>}
          {!isFetching && results.length === 0 && (
            <div className="px-3 py-1.5 text-[12.5px] text-ink-faint">{t('reports.noClientsFound')}</div>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => select(user)}
              className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-surface-muted"
            >
              {user.fullName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
