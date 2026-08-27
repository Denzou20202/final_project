import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PriorityBadge } from '../components/tickets/PriorityBadge.js';
import { StatusBadge } from '../components/tickets/StatusBadge.js';
import { useTicketSearch } from '../hooks/useSearch.js';
import { useTicketStatuses } from '../hooks/useTicketStatuses.js';

// Elasticsearch wraps matches in <em>...</em>; splitting on that marker and
// rendering plain-text segments (rather than dangerouslySetInnerHTML) keeps
// React's normal text-escaping in place — ticket titles/descriptions are
// client-controlled input, so raw HTML in a highlight fragment must never
// reach innerHTML.
function renderHighlight(fragment: string): ReactNode {
  return fragment.split(/(<em>.*?<\/em>)/g).map((part, index) => {
    const match = /^<em>(.*)<\/em>$/.exec(part);
    if (match) {
      return (
        <mark key={index} className="rounded bg-brand-100 px-0.5 text-brand-700">
          {match[1]}
        </mark>
      );
    }
    return part;
  });
}

export default function SearchResultsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') ?? '';
  const { data: results, isLoading, isError } = useTicketSearch(q);
  // Search hits only carry the status id (see SearchIndexProcessor's own
  // comment for why the full status isn't denormalized into the index) —
  // resolved here against the already-cached catalog.
  const { data: statuses } = useTicketStatuses();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none px-6 pb-3.5 pt-4">
        <div className="font-display text-lg font-bold">{t('search.title')}</div>
        <div className="mt-0.5 text-[12.5px] text-ink-subtle">«{q}»</div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('search.searching')}</div>}
        {isError && <div className="py-16 text-center text-sm text-priority-urgent">{t('search.searchFailed')}</div>}

        {!isLoading && !isError && results?.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('search.nothingFound')}</div>
            <div className="mt-1 text-[13px] text-ink-faint">{t('search.tryAnotherQuery')}</div>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((result) => {
              const status = statuses?.find((s) => s.id === result.status);
              return (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => navigate(`/tickets/${result.id}`)}
                  className="flex flex-col gap-1 rounded-2xl border border-border bg-surface-card p-4 text-left hover:border-brand-600"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{renderHighlight(result.highlight['title']?.[0] ?? result.title)}</div>
                    {status && <StatusBadge status={status} />}
                    <PriorityBadge priority={result.priority} />
                  </div>
                  {result.highlight['description']?.[0] && (
                    <div className="text-[13px] text-ink-muted">{renderHighlight(result.highlight['description'][0])}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
