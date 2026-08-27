import { zodResolver } from '@hookform/resolvers/zod';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { RichTextEditor } from '../components/chat/RichTextEditor.js';
import { useAutoTranslate } from '../hooks/useAutoTranslate.js';
import {
  useArticle,
  useCreateArticle,
  useDeleteArticle,
  usePublishArticle,
  useUnpublishArticle,
  useUpdateArticle,
} from '../hooks/useArticles.js';
import { IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES, uploadArticleImage } from '../lib/api/article-images.api.js';
import { clipboardHasTable } from '../lib/clipboard.js';
import { getErrorMessage } from '../lib/errors.js';

type FormValues = { title: string; titleUk: string; titleEn: string; isPublic: boolean };

export default function KnowledgeEditorPage() {
  const { t } = useTranslation();
  const { articleId } = useParams<{ articleId: string }>();
  const isEditing = !!articleId;
  const navigate = useNavigate();
  // Rebuilt on language change so the validation message follows the
  // active locale — a module-level schema would freeze at whatever
  // language was active on first import.
  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(3, t('admin.knowledge.titleMinLength')),
        titleUk: z.string(),
        titleEn: z.string(),
        isPublic: z.boolean(),
      }),
    [t],
  );
  // Mount-time-only seed for the placeholder text, same pattern as
  // ActionRow's initialFormula — Tiptap doesn't react to a changed
  // `extensions` array on an already-mounted editor, so this only picks up
  // the language active when the page first opens, kept in sync with
  // sanitizeArticleBody's allowlist in libs/common (nothing this editor can
  // produce — StarterKit formatting plus pasted images — ever gets stripped
  // server-side; StarterKit bundles Underline itself in Tiptap v3, unlike
  // v2, so no separate import is needed).
  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: false, horizontalRule: false, codeBlock: false, strike: false }),
      Placeholder.configure({ placeholder: t('admin.knowledge.contentPlaceholder') }),
      Image,
      // resizable: false — column-drag resizing would emit inline
      // width styling sanitizeArticleBody strips on save anyway (see its
      // own comment on why), so the UI for it would silently not persist.
      // TableKit bundles Table/TableRow/TableHeader/TableCell as one
      // Extension (@tiptap/extension-table) instead of four separate
      // packages.
      TableKit.configure({ table: { resizable: false } }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { data: article, isLoading } = useArticle(articleId);
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle(articleId ?? '');
  const publishArticle = usePublishArticle(articleId ?? '');
  const unpublishArticle = useUnpublishArticle(articleId ?? '');
  const deleteArticle = useDeleteArticle();
  const [contentError, setContentError] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { titleUk: '', titleEn: '', isPublic: false },
  });
  // Skips auto-fill for an existing article being edited — its uk/en may
  // already be deliberately set (or deliberately left blank), same guard
  // as the modal-based catalog forms.
  const [ukEnTouched, setUkEnTouched] = useState(isEditing);
  const title = watch('title');
  useAutoTranslate(
    title,
    !ukEnTouched,
    useCallback(
      (uk, en) => {
        if (uk) setValue('titleUk', uk);
        if (en) setValue('titleEn', en);
      },
      [setValue],
    ),
  );

  // Pasting a screenshot uploads it immediately and drops it straight into
  // the document at the cursor — there's no staging step here the way the
  // chat composer has one, since an article is one continuous document
  // being edited, not a discrete message being composed and sent.
  async function handleImagePaste(file: File): Promise<boolean> {
    if (!IMAGE_MIME_TYPES.has(file.type)) return false;
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError(t('admin.knowledge.imageTooLarge'));
      return true;
    }
    setImageError(undefined);
    try {
      const { url } = await uploadArticleImage(file);
      editor?.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      setImageError(getErrorMessage(err));
    }
    return true;
  }

  const editor = useEditor({
    extensions,
    content: '',
    editorProps: {
      // clipboardHasTable bails out first — pasting a range copied from
      // Excel/Sheets puts both a bitmap and a real <table> on the clipboard,
      // and without this check the bitmap would win, degrading a real table
      // into a flat picture instead of letting TableKit parse the table.
      handlePaste: (_view, event) => {
        if (clipboardHasTable(event)) return false;
        const files = Array.from(event.clipboardData?.items ?? [])
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null && file.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file) => void handleImagePaste(file));
        return true;
      },
    },
  });

  useEffect(() => {
    if (article) {
      reset({ title: article.title, titleUk: article.titleUk ?? '', titleEn: article.titleEn ?? '', isPublic: article.isPublic });
      editor?.commands.setContent(article.content);
    }
    // editor is included so this still sets content if the article finishes
    // loading before Tiptap's editor instance is ready — harmless no-op the
    // rest of the time, since editor stays referentially stable afterward.
  }, [article, reset, editor]);

  const onSubmit = (values: FormValues) => {
    if (!editor || editor.isEmpty) {
      setContentError(t('admin.knowledge.contentRequired'));
      return;
    }
    setContentError(undefined);
    const payload = { ...values, content: editor.getHTML() };
    if (isEditing) {
      updateArticle.mutate(payload);
    } else {
      createArticle.mutate(payload, {
        onSuccess: (created) => navigate(`/knowledge/${created.id}`, { replace: true }),
      });
    }
  };

  function handleDelete() {
    if (!articleId) return;
    if (!window.confirm(t('admin.knowledge.deleteConfirm'))) return;
    deleteArticle.mutate(articleId, { onSuccess: () => navigate('/knowledge') });
  }

  const saveError = updateArticle.error ?? createArticle.error ?? deleteArticle.error;
  const errorMessage = saveError ? getErrorMessage(saveError) : undefined;

  if (isEditing && isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-ink-subtle">{t('common.loading')}</div>;
  }

  return (
    <div className="flex h-full justify-center overflow-auto px-6 py-8">
      <div className="w-full max-w-2xl">
        <Link to="/knowledge" className="text-[12px] text-ink-subtle hover:text-brand-600">
          ← {t('admin.knowledge.backToList')}
        </Link>

        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-display text-lg font-bold">
            {isEditing ? t('admin.knowledge.editTitle') : t('admin.knowledge.newTitle')}
          </h1>
          {article && (
            <span className={`text-[12.5px] font-medium ${article.status === 'published' ? 'text-status-resolved' : 'text-ink-faint'}`}>
              {t(`articleStatus.${article.status}`)}
            </span>
          )}
          {article && (
            <span className="text-[12.5px] text-ink-faint">
              {t('admin.knowledge.viewsLabel', { count: article.viewCount })}
              {(article.helpfulCount > 0 || article.notHelpfulCount > 0) && (
                <>
                  {' · '}
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
            </span>
          )}
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-6"
          noValidate
        >
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.knowledge.titleLabel')}
            </label>
            <input
              id="title"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('title')}
            />
            {errors.title && <p className="mt-1 text-xs text-priority-urgent">{errors.title.message}</p>}
          </div>

          <div>
            <label htmlFor="titleUk" className="mb-1 block text-sm font-medium text-ink-muted">
              UK
            </label>
            <input
              id="titleUk"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('titleUk', { onChange: () => setUkEnTouched(true) })}
            />
          </div>

          <div>
            <label htmlFor="titleEn" className="mb-1 block text-sm font-medium text-ink-muted">
              EN
            </label>
            <input
              id="titleEn"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('titleEn', { onChange: () => setUkEnTouched(true) })}
            />
            <p className="mt-1 text-[11px] text-ink-faint">{t('settings.autoTranslateHint')}</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
              <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('isPublic')} />
              {t('admin.knowledge.isPublicLabel')}
            </label>
            <p className="mt-1 text-[11.5px] text-ink-faint">{t('admin.knowledge.isPublicHint')}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">{t('admin.knowledge.contentLabel')}</label>
            <RichTextEditor editor={editor} minHeight="16rem" maxHeight="32rem" showTable />
            <p className="mt-1 text-[11.5px] text-ink-faint">{t('admin.knowledge.pasteHint')}</p>
            {contentError && <p className="mt-1 text-xs text-priority-urgent">{contentError}</p>}
            {imageError && <p className="mt-1 text-xs text-priority-urgent">{imageError}</p>}
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{errorMessage}</p>
          )}

          <div className="mt-1 flex items-center justify-between gap-2">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-priority-urgent hover:bg-priority-urgent/10"
                >
                  {t('admin.knowledge.delete')}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {isEditing && article?.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => publishArticle.mutate()}
                  disabled={publishArticle.isPending}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-60"
                >
                  {publishArticle.isPending ? t('admin.knowledge.publishing') : t('admin.knowledge.publish')}
                </button>
              )}
              {isEditing && article?.status === 'published' && (
                <button
                  type="button"
                  onClick={() => unpublishArticle.mutate()}
                  disabled={unpublishArticle.isPending}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-60"
                >
                  {unpublishArticle.isPending ? t('admin.knowledge.unpublishing') : t('admin.knowledge.unpublish')}
                </button>
              )}
              <button
                type="submit"
                disabled={createArticle.isPending || updateArticle.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {createArticle.isPending || updateArticle.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
