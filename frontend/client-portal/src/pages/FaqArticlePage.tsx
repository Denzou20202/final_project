import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ImagePreviewModal } from '../components/common/ImagePreviewModal.js';
import { LogoMark } from '../components/common/LogoMark.js';
import { usePublishedArticle, useRateArticle } from '../hooks/useArticles.js';
import { useKnowledgeTheme } from '../hooks/useKnowledgeTheme.js';
import { toIntlLocale } from '../lib/format.js';
import { pickLocalized } from '../lib/localized.js';
import { useAuthStore } from '../store/auth.store.js';

function formatDate(iso: string, language: string): string {
  return new Date(iso).toLocaleDateString(toIntlLocale(language), { day: '2-digit', month: 'long', year: 'numeric' });
}

const RATED_STORAGE_PREFIX = 'veloxdesk-faq-rated-';

// Soft, best-effort dedup only — the FAQ is unauthenticated by design, so
// there's no visitor identity to gate a real per-user vote on. This just
// stops the same browser from re-voting on a return visit, not abuse.
function hasAlreadyRated(articleId: string): boolean {
  return localStorage.getItem(RATED_STORAGE_PREFIX + articleId) !== null;
}

function markRated(articleId: string): void {
  localStorage.setItem(RATED_STORAGE_PREFIX + articleId, '1');
}

export default function FaqArticlePage() {
  const { t, i18n } = useTranslation();
  const { articleId } = useParams<{ articleId: string }>();
  const isAuthenticated = !!useAuthStore((s) => s.accessToken);
  const { data: article, isLoading, isError } = usePublishedArticle(articleId);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [rated, setRated] = useState(() => (articleId ? hasAlreadyRated(articleId) : false));
  const rateArticle = useRateArticle(articleId ?? '');
  useKnowledgeTheme();

  function handleRate(helpful: boolean) {
    if (!articleId || rated) return;
    setRated(true);
    markRated(articleId);
    rateArticle.mutate(helpful);
  }

  // Event delegation: article.content is injected HTML (sanitized server-
  // side via sanitizeArticleBody), so any <img> inside it is a plain DOM
  // node React never mounted — a single click listener on the container is
  // the only way to react to clicks on it.
  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLImageElement) {
      setPreviewSrc(target.src);
    }
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
        <Link to="/faq" className="text-[12px] text-ink-subtle hover:text-brand-600">
          ← {t('faq.backToAllArticles')}
        </Link>

        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}
        {isError && (
          <div className="py-16 text-center text-sm text-priority-urgent">{t('faq.articleNotFound')}</div>
        )}

        {article && (
          <article className="mt-3 rounded-2xl border border-border bg-surface-card p-8">
            <h1 className="font-display text-xl font-bold">
              {pickLocalized(article.title, article.titleUk, article.titleEn, i18n.language)}
            </h1>
            {article.publishedAt && (
              <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-faint">
                <span>{t('faq.publishedOn', { date: formatDate(article.publishedAt, i18n.language) })}</span>
                <span>·</span>
                <span>{t('faq.viewsCount', { count: article.viewCount })}</span>
              </div>
            )}
            <div
              className="mt-4 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-muted [&_img]:my-2 [&_img]:max-w-full [&_img]:cursor-pointer [&_img]:rounded-lg [&_table]:my-3 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top [&_th]:border [&_th]:border-border [&_th]:bg-surface-muted [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold"
              onClick={handleContentClick}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            <div className="mt-6 flex items-center gap-3 border-t border-border-subtle pt-4">
              {rated ? (
                <span className="text-[13px] text-ink-subtle">{t('faq.rateThanks')}</span>
              ) : (
                <>
                  <span className="text-[13px] text-ink-subtle">{t('faq.rateQuestion')}</span>
                  <button
                    type="button"
                    onClick={() => handleRate(true)}
                    className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:border-brand-600 hover:text-brand-600"
                  >
                    <span role="img" aria-label={t('faq.rateHelpfulAria')}>
                      👍
                    </span>{' '}
                    {t('faq.rateHelpful')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate(false)}
                    className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:border-priority-urgent hover:text-priority-urgent"
                  >
                    <span role="img" aria-label={t('faq.rateNotHelpfulAria')}>
                      👎
                    </span>{' '}
                    {t('faq.rateNotHelpful')}
                  </button>
                </>
              )}
            </div>
          </article>
        )}
      </div>

      {previewSrc && <ImagePreviewModal src={previewSrc} onClose={() => setPreviewSrc(null)} />}
    </div>
  );
}
