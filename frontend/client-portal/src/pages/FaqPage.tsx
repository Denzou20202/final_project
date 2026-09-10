import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/common/LogoMark.js';
import { useArticleSearch, usePublishedArticles } from '../hooks/useArticles.js';
import { useKnowledgeTheme } from '../hooks/useKnowledgeTheme.js';
import { renderHighlight } from '../lib/highlight.js';
import { pickLocalized } from '../lib/localized.js';
import { useAuthStore } from '../store/auth.store.js';

export default function FaqPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = !!useAuthStore((s) => s.accessToken);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'popular'>('popular');
  useKnowledgeTheme();

  const { data: allArticles, isLoading: isListLoading } = usePublishedArticles(sort);
  const { data: searchResults, isLoading: isSearchLoading } = useArticleSearch(submittedQuery);

  const isSearching = submittedQuery.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedQuery(query);
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface-sidebar px-6 py-3.5">
        <Link to="/faq" className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="font-display text-[15px] font-bold leading-tight text-ink-subtle">{t('faq.helpSuffix')}</span>
        </Link>
        <div className="flex-1" />
        <Link to={isAuthenticated ? '/tickets' : '/login'} className="text-[13px] font-medium text-brand-600 hover:underline">
          {isAuthenticated ? t('faq.myTickets') : t('auth.login')}
        </Link>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-bold">{t('faq.title')}</h1>
        <form onSubmit={handleSubmit} className="mt-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('faq.searchPlaceholder')}
            className="w-full rounded-lg border border-border bg-surface-card px-4 py-3 text-sm outline-none focus:border-brand-600"
          />
        </form>

        <div className="mt-8">
          {isSearching ? (
            <>
              <div className="mb-3 text-[12.5px] text-ink-subtle">{t('faq.resultsFor', { query: submittedQuery })}</div>
              {isSearchLoading && <div className="py-10 text-center text-sm text-ink-subtle">{t('faq.searching')}</div>}
              {!isSearchLoading && searchResults?.length === 0 && (
                <div className="rounded-2xl border border-border bg-surface-card py-10 text-center text-sm text-ink-faint">
                  {t('faq.nothingFound')}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {searchResults?.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => navigate(`/faq/${result.id}`)}
                    className="rounded-2xl border border-border bg-surface-card p-4 text-left font-medium hover:border-brand-600"
                  >
                    {renderHighlight(
                      result.highlight['title']?.[0] ??
                        pickLocalized(result.title, result.titleUk, result.titleEn, i18n.language),
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12.5px] text-ink-subtle">
                  {sort === 'popular' ? t('faq.popularArticles') : t('faq.recentArticles')}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setSort('popular')}
                    className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                      sort === 'popular' ? 'bg-brand-50 text-brand-700' : 'text-ink-faint hover:bg-surface-card'
                    }`}
                  >
                    {t('faq.sortPopular')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSort('recent')}
                    className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                      sort === 'recent' ? 'bg-brand-50 text-brand-700' : 'text-ink-faint hover:bg-surface-card'
                    }`}
                  >
                    {t('faq.sortRecent')}
                  </button>
                </div>
              </div>
              {isListLoading && <div className="py-10 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}
              {!isListLoading && allArticles?.items.length === 0 && (
                <div className="rounded-2xl border border-border bg-surface-card py-10 text-center text-sm text-ink-faint">
                  {t('faq.noArticlesYet')}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {allArticles?.items.map((article) => (
                  <Link
                    key={article.id}
                    to={`/faq/${article.id}`}
                    className="rounded-2xl border border-border bg-surface-card p-4 font-medium hover:border-brand-600"
                  >
                    {pickLocalized(article.title, article.titleUk, article.titleEn, i18n.language)}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
