import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useAuth.js';
import { useAutoTranslate } from '../../hooks/useAutoTranslate.js';
import { useAllTags, useDeleteTag, useRenameTag } from '../../hooks/useTags.js';
import { useTicketCountsByTag } from '../../hooks/useTickets.js';
import { getErrorMessage } from '../../lib/errors.js';
import { pickLocalized } from '../../lib/localized.js';
import { CloseIcon } from '../common/icons.js';
import { PageLoading } from '../common/PageLoading.js';

// Same overlay/escape-close/header shell as PendingRegistrationsModal — a
// single list, no sub-sections. Replaces the old always-visible «Метки»
// section in the wide Sidebar (moved behind its own IconRail icon).
// Deleting a tag is admin-only and only enabled once its ticket count hits
// zero — the backend rejects it either way (TagsService.remove), this just
// avoids a round trip for the common "still in use" case. Renaming is also
// admin-only (same catalog-management tier), but has no such usage guard —
// it's safe at any count, since it just relabels a row every ticket that
// already carries the tag will pick up.
export function TagsModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const { data: tags, isLoading } = useAllTags();
  const { data: countsByTag } = useTicketCountsByTag();
  const deleteTag = useDeleteTag();
  const renameTag = useRenameTag();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editValueUk, setEditValueUk] = useState('');
  const [editValueEn, setEditValueEn] = useState('');
  // Renaming an already-translated tag shouldn't silently overwrite a
  // deliberate uk/en correction just because the admin re-touched the RU
  // spelling — same "skip once hand-edited" guard as the modal-based forms.
  const [ukEnTouched, setUkEnTouched] = useState(false);
  useAutoTranslate(
    editValue,
    editingId !== null && !ukEnTouched,
    useCallback((uk, en) => {
      if (uk) setEditValueUk(uk);
      if (en) setEditValueEn(en);
    }, []),
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function showTag(tagId: string) {
    navigate(`/tickets?tagId=${tagId}`);
    onClose();
  }

  function handleDelete(tag: { id: string; name: string }) {
    if (!window.confirm(t('tagsModal.deleteConfirm', { name: tag.name }))) return;
    deleteTag.mutate(tag.id);
  }

  function startEdit(tag: { id: string; name: string; nameUk?: string | null; nameEn?: string | null }) {
    renameTag.reset();
    setEditingId(tag.id);
    setEditValue(tag.name);
    setEditValueUk(tag.nameUk ?? '');
    setEditValueEn(tag.nameEn ?? '');
    setUkEnTouched(false);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(id: string) {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    renameTag.mutate(
      { id, name: trimmed, nameUk: editValueUk.trim(), nameEn: editValueEn.trim() },
      { onSuccess: () => setEditingId(null) },
    );
  }

  const deleteError = deleteTag.error ? getErrorMessage(deleteTag.error) : undefined;
  const renameError = renameTag.error ? getErrorMessage(renameTag.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-lg sm:h-[85vh] sm:w-[85vw] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-border">
        <div className="flex flex-none items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="font-display text-base font-bold">{t('tagsModal.title')}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('tagsModal.count', { count: tags?.length ?? 0 })}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('common.close')}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-priority-urgent"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {isLoading && <PageLoading />}

          {(deleteError || renameError) && (
            <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">
              {deleteError ?? renameError}
            </p>
          )}

          {!isLoading && (tags?.length ?? 0) === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="font-display text-sm font-semibold text-ink-muted">{t('tagsModal.empty')}</div>
            </div>
          )}

          {!isLoading && (tags?.length ?? 0) > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-bold">{t('tagsModal.columnName')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('tagsModal.columnCount')}</th>
                    {isAdmin && <th className="px-4 py-2.5 font-bold" />}
                  </tr>
                </thead>
                <tbody>
                  {tags?.map((tag) => {
                    const count = countsByTag?.[tag.id]?.total ?? 0;
                    const isEditing = editingId === tag.id;
                    return (
                      <tr key={tag.id} className="border-b border-border-subtle text-[13.5px] last:border-0">
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5">
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(tag.id);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                className="w-full rounded-lg border border-border bg-surface-card px-2 py-1 text-[13.5px] outline-none focus:border-brand-600"
                              />
                              <div className="flex items-center gap-1.5">
                                <span className="w-6 flex-none text-[10.5px] font-bold text-ink-faint">UK</span>
                                <input
                                  value={editValueUk}
                                  onChange={(e) => {
                                    setEditValueUk(e.target.value);
                                    setUkEnTouched(true);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(tag.id);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  className="w-full rounded-lg border border-border bg-surface-card px-2 py-1 text-[12.5px] outline-none focus:border-brand-600"
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-6 flex-none text-[10.5px] font-bold text-ink-faint">EN</span>
                                <input
                                  value={editValueEn}
                                  onChange={(e) => {
                                    setEditValueEn(e.target.value);
                                    setUkEnTouched(true);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(tag.id);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  className="w-full rounded-lg border border-border bg-surface-card px-2 py-1 text-[12.5px] outline-none focus:border-brand-600"
                                />
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => showTag(tag.id)}
                              className="font-medium text-brand-600 hover:underline"
                            >
                              {pickLocalized(tag.name, tag.nameUk, tag.nameEn, i18n.language)}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{count}</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-3">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(tag.id)}
                                    disabled={!editValue.trim() || renameTag.isPending}
                                    className="text-[12.5px] font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {t('common.save')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="text-[12.5px] font-medium text-ink-muted hover:underline"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(tag)}
                                    className="text-[12.5px] font-medium text-ink-muted hover:underline"
                                  >
                                    {t('tagsModal.edit')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(tag)}
                                    disabled={count > 0 || deleteTag.isPending}
                                    title={count > 0 ? t('tagsModal.cannotDeleteInUse') : t('tagsModal.delete')}
                                    className="text-[12.5px] font-medium text-priority-urgent hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline disabled:opacity-60"
                                  >
                                    {t('tagsModal.delete')}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
