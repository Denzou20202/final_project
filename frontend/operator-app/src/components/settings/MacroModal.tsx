import { zodResolver } from '@hookform/resolvers/zod';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAutoTranslate } from '../../hooks/useAutoTranslate.js';
import { useCreateMacro, useUpdateMacro } from '../../hooks/useMacros.js';
import { IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES, uploadArticleImage } from '../../lib/api/article-images.api.js';
import { clipboardHasTable } from '../../lib/clipboard.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicMacro } from '../../lib/types.js';
import { RichTextEditor } from '../chat/RichTextEditor.js';

type FormValues = { title: string; titleUk: string; titleEn: string };

export function MacroModal({ existing, onClose }: { existing: PublicMacro | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  // Rebuilt on language change so validation messages follow the active
  // locale — a module-level schema would freeze at whatever language was
  // active on first import.
  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(2, t('admin.macros.titleMinLength')),
        titleUk: z.string(),
        titleEn: z.string(),
      }),
    [t],
  );
  const createMacro = useCreateMacro();
  const updateMacro = useUpdateMacro();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? { title: existing.title, titleUk: existing.titleUk ?? '', titleEn: existing.titleEn ?? '' }
      : { titleUk: '', titleEn: '' },
  });
  const [ukEnTouched, setUkEnTouched] = useState(!!existing);
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

  const [bodyError, setBodyError] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState<string | undefined>(undefined);

  // Same extension shape as ChatPanel's reply editor (StarterKit link +
  // Image + TableKit) — a macro's saved HTML gets parsed straight into that
  // editor's schema when applied (see ChatPanel's insertMacro), so anything
  // this editor can produce must be something that one can also render.
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        codeBlock: false,
        strike: false,
        link: { openOnClick: false },
      }),
      Placeholder.configure({ placeholder: t('admin.macros.bodyPlaceholder') }),
      Image,
      TableKit.configure({ table: { resizable: false } }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Pasting a screenshot uploads it immediately and drops it inline —
  // same as KnowledgeEditorPage's own handleImagePaste.
  async function handleImagePaste(file: File): Promise<boolean> {
    if (!IMAGE_MIME_TYPES.has(file.type)) return false;
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError(t('admin.macros.imageTooLarge'));
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

  async function handleInsertImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = Array.from(IMAGE_MIME_TYPES).join(',');
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void handleImagePaste(file);
    };
    input.click();
  }

  // existing is already available synchronously (passed straight from the
  // already-fetched macros list, unlike KnowledgeEditorPage's article which
  // loads async), so the initial content can just be seeded here directly —
  // no separate setContent-on-load effect needed.
  const editor = useEditor({
    extensions,
    content: existing?.body ?? '',
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
  }, []);

  const onSubmit = (values: FormValues) => {
    if (!editor || editor.isEmpty) {
      setBodyError(t('admin.macros.bodyRequired'));
      return;
    }
    setBodyError(undefined);
    const payload = { ...values, body: editor.getHTML() };
    if (existing) {
      updateMacro.mutate({ id: existing.id, ...payload }, { onSuccess: onClose });
    } else {
      createMacro.mutate(payload, { onSuccess: onClose });
    }
  };

  const mutation = existing ? updateMacro : createMacro;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.macros.editTitle') : t('admin.macros.newTitle')}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.macros.titleLabel')}
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
            <label className="mb-1 block text-sm font-medium text-ink-muted">{t('admin.macros.bodyLabel')}</label>
            <RichTextEditor editor={editor} minHeight="8rem" maxHeight="20rem" showImage onInsertImage={handleInsertImage} showLink showTable />
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">{t('admin.macros.pasteHint')}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
              {t('admin.macros.tagsHintIntro')}{' '}
              <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11px]">{'{{client.fullName}}'}</code>{' '}
              {t('admin.macros.tagClientDesc')},{' '}
              <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11px]">{'{{operator.fullName}}'}</code>{' '}
              {t('admin.macros.tagOperatorDesc')},{' '}
              <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11px]">{'{{ticket.number}}'}</code>{' '}
              {t('admin.macros.tagTicketDesc')}
            </p>
            {bodyError && <p className="mt-1 text-xs text-priority-urgent">{bodyError}</p>}
            {imageError && <p className="mt-1 text-xs text-priority-urgent">{imageError}</p>}
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{errorMessage}</p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
