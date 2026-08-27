import type { KnowledgeArticleStatus } from '@veloxdesk/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useArticlesList } from '../hooks/useArticles.js';
import { formatDateTime as formatDate } from '../lib/format.js';
import { pickLocalized } from '../lib/localized.js';

const STATUS_CLASSES: Record<KnowledgeArticleStatus, string> = {
  draft: 'text-ink-faint',
  published: 'text-status-resolved',
} as Record<KnowledgeArticleStatus, string>;

export default function KnowledgeListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<KnowledgeArticleStatus | ''>('');
  const { data, isLoading, isError } = useArticlesList(statusFilter || undefined);
  const articles = data?.items ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-col gap-2.5 px-4 pb-3.5 pt-4 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.knowledge.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.knowledge.count', { count: articles.length })}</div>
        </div>
        <div className="hidden flex-1 sm:block" />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as KnowledgeArticleStatus | '')}
            className="rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] text-ink-muted outline-none"
          >
            <option value="">{t('admin.knowledge.allArticles')}</option>
            <option value="draft">{t('admin.knowledge.draftsOption')}</option>
            <option value="published">{t('admin.knowledge.publishedOption')}</option>
          </select>
          <button
            type="button"
            onClick={() => navigate('/knowledge/new')}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
          >
            {t('admin.knowledge.newArticle')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}
        {isError && <div className="py-16 text-center text-sm text-priority-urgent">{t('admin.knowledge.loadError')}</div>}

        {!isLoading && !isError && articles.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.knowledge.empty')}</div>
            <div className="mt-1 text-[13px] text-ink-faint">{t('admin.knowledge.emptyHint')}</div>
          </div>
        )}

        {articles.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.knowledge.columnTitle')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.knowledge.columnStatus')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.knowledge.columnVisibility')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.knowledge.columnViews')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.knowledge.columnHelpful')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.knowledge.columnUpdated')}</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr
                    key={article.id}
                    onClick={() => navigate(`/knowledge/${article.id}`)}
                    className="cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted"
                  >
                    <td className="max-w-md truncate px-4 py-3 font-medium">
                      {pickLocalized(article.title, article.titleUk, article.titleEn, i18n.language)}
                    </td>
                    <td className={`px-4 py-3 font-medium ${STATUS_CLASSES[article.status]}`}>
                      {t(`articleStatus.${article.status}`)}
                    </td>
                    <td className={`px-4 py-3 font-medium ${article.isPublic ? 'text-status-resolved' : 'text-ink-faint'}`}>
                      {article.isPublic ? t('admin.knowledge.visibilityPublic') : t('admin.knowledge.visibilityPrivate')}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">{article.viewCount}</td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {article.helpfulCount + article.notHelpfulCount === 0 ? (
                        '—'
                      ) : (
                        <>
                          <span className="text-status-open">
                            <span role="img" aria-label={t('admin.knowledge.helpfulAria')}>
                              👍
                            </span>{' '}
                            {article.helpfulCount}
                          </span>{' '}
                          <span className="text-priority-urgent">
                            <span role="img" aria-label={t('admin.knowledge.notHelpfulAria')}>
                              👎
                            </span>{' '}
                            {article.notHelpfulCount}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">{formatDate(article.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
