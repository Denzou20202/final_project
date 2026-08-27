import { zodResolver } from '@hookform/resolvers/zod';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import type { EditorView } from '@tiptap/pm/view';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { TFunction } from 'i18next';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { RichTextEditor } from '../components/chat/RichTextEditor.js';
import { useTicketCategories } from '../hooks/useTicketCategories.js';
import { useCreateTicket } from '../hooks/useTickets.js';
import { uploadAttachment } from '../lib/api/attachments.api.js';
import { clipboardHasTable } from '../lib/clipboard.js';
import { getErrorMessage } from '../lib/errors.js';
import { pickLocalized } from '../lib/localized.js';

type FormValues = { title: string; categoryId: string };

// Kept in sync with MAX_FILE_SIZE_BYTES in attachments.controller.ts —
// rejecting an oversized file client-side is instant feedback instead of
// waiting on a full upload attempt (or nginx's 413) to find out.
const MAX_ATTACHMENT_SIZE_BYTES = 35 * 1024 * 1024;

// Most popular screenshot formats — matches ALLOWED_MIME_TYPES' image
// branch in attachments.controller.ts.
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

// Same pattern as ALLOWED_MIME_TYPES in attachments.controller.ts — an
// approximation, not the source of truth (the backend's FileTypeValidator
// sniffs actual file bytes via magic numbers, this only reads the
// browser-reported MIME type), but good enough to reject an obviously
// disallowed pick before spending bandwidth on a doomed upload instead of
// only finding out after it finishes.
const ALLOWED_ATTACHMENT_MIME_TYPES =
  /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm|quicktime|x-m4v)|application\/(pdf|zip|x-rar-compressed|vnd\.rar|msword|vnd\.openxmlformats-officedocument\..+)|text\/(plain|csv))$/;

function formatFileSize(t: TFunction, bytes: number): string {
  if (bytes < 1024) return t('chat.fileSizeBytes', { count: bytes });
  if (bytes < 1024 * 1024) return t('chat.fileSizeKB', { count: (bytes / 1024).toFixed(1) });
  return t('chat.fileSizeMB', { count: (bytes / (1024 * 1024)).toFixed(1) });
}

export default function NewTicketPage() {
  const { t, i18n } = useTranslation();
  // Rebuilt on language change so validation messages follow the active
  // locale — a module-level schema would freeze at whatever language was
  // active on first import.
  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(3, t('newTicket.titleMinLength')),
        categoryId: z.string(),
      }),
    [t],
  );
  const createTicket = useCreateTicket();
  const { data: categories } = useTicketCategories();
  const navigate = useNavigate();
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [sizeError, setSizeError] = useState<string | undefined>(undefined);
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const [isUploading, setUploading] = useState(false);
  // Set once the ticket itself is actually created — lets a retry (after a
  // partial attachment-upload failure below) re-attempt just the remaining
  // files instead of submitting the title/description again and creating a
  // second ticket.
  const createdTicketRef = useRef<{ id: string; descriptionCommentId: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { categoryId: '' } });

  function stageFiles(files: File[]) {
    // Uploads (onSubmit below) read stagedFiles once, before their own
    // await — a file staged mid-upload via paste or the file input (both
    // of which used to stay live the whole time) would either race that
    // snapshot or simply vanish once the upload's functional setStagedFiles
    // update below settles. Blocking new files at the source, same as
    // ChatPanel's handlePaste/isSending guard, closes that off entirely
    // instead of just making the merge more defensive.
    if (isUploading || files.length === 0) return;
    const tooBig = files.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES);
    if (tooBig) {
      setSizeError(t('chat.fileTooLarge', { name: tooBig.name }));
      return;
    }
    // Only checked when the browser actually reports a MIME type — an
    // empty file.type (some OS file pickers omit it for unrecognized
    // extensions) is deliberately let through rather than blocked
    // client-side; the backend's real magic-number check still applies.
    const badType = files.find((file) => file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.test(file.type));
    if (badType) {
      setSizeError(t('chat.fileUnsupportedType', { name: badType.name }));
      return;
    }
    setSizeError(undefined);
    setStagedFiles((prev) => [...prev, ...files]);
  }

  // stageFiles is recreated every render — editorProps below is memoized
  // with `[]` deps (see its own comment for why), so handlePaste reaches
  // back through this ref instead of closing over a value that could go
  // stale, same pattern ChatPanel uses for its own handlePaste/submit.
  const stageFilesRef = useRef(stageFiles);
  stageFilesRef.current = stageFiles;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    stageFiles(files);
  }

  function removeStagedFile(index: number) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // `description` is pulled out of react-hook-form entirely and tracked off
  // the editor instance directly, same pattern as KnowledgeEditorPage's
  // article body and operator-app's CreateTicketModal (its own copy of this
  // same form, staff-side) — a Tiptap editor's content isn't a controllable
  // form field the way a plain <textarea> was. TableKit config mirrors
  // KnowledgeEditorPage's own (resizing disabled — see that page's comment
  // on why).
  const descriptionExtensions = useMemo(
    () => [
      StarterKit.configure({ heading: false, horizontalRule: false, codeBlock: false, strike: false }),
      Placeholder.configure({ placeholder: t('newTicket.descriptionLabel') }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // A screenshot copied to the clipboard pastes as image clipboard data,
  // not text — stage it the same way the file picker does instead of
  // letting ProseMirror try to insert it as an editor node (StarterKit has
  // no image support, so a raw image paste would otherwise just be
  // silently dropped). Identical to ChatPanel's own handlePaste.
  const descriptionEditorProps = useMemo(
    () => ({
      // clipboardHasTable bails out first — pasting a range copied from
      // Excel/Sheets puts both a bitmap and a real <table> on the clipboard,
      // and without this check the bitmap would win, degrading a real table
      // into a flat picture attachment instead of letting TableKit parse it.
      handlePaste: (_view: EditorView, event: ClipboardEvent) => {
        if (clipboardHasTable(event)) return false;
        const files = Array.from(event.clipboardData?.items ?? [])
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null && IMAGE_MIME_TYPES.has(file.type));
        if (files.length === 0) return false;
        event.preventDefault();
        stageFilesRef.current(files);
        return true;
      },
    }),
    [],
  );
  const [descriptionError, setDescriptionError] = useState<string | undefined>(undefined);
  const descriptionEditor = useEditor({
    extensions: descriptionExtensions,
    content: '',
    editorProps: descriptionEditorProps,
    onUpdate: () => setDescriptionError(undefined),
  });

  const onSubmit = async (values: FormValues) => {
    if (!descriptionEditor || descriptionEditor.isEmpty) {
      setDescriptionError(t('newTicket.descriptionRequired'));
      return;
    }
    setUploadError(undefined);
    const ticket =
      createdTicketRef.current ??
      (await createTicket.mutateAsync({
        title: values.title,
        description: descriptionEditor.getHTML(),
        categoryId: values.categoryId || undefined,
      }));
    createdTicketRef.current = ticket;
    if (stagedFiles.length > 0) {
      setUploading(true);
      // allSettled, not all: the ticket already exists at this point, so one
      // failed upload shouldn't stop the rest. Failed files stay staged (and
      // this function stays on the page instead of navigating away) so a
      // resubmit retries only those, reusing the ticket already created
      // above rather than creating a second one.
      const results = await Promise.allSettled(
        stagedFiles.map((file) => uploadAttachment(ticket.id, file, ticket.descriptionCommentId)),
      );
      const stillFailed = stagedFiles.filter((_, i) => results[i].status === 'rejected');
      // Functional update against `prev`, not a plain overwrite with this
      // pre-await snapshot — stageFiles is now blocked while isUploading
      // (see its own comment), so in practice prev already equals this
      // snapshot, but computing off prev keeps this correct on its own
      // terms rather than depending on that other guard never changing.
      const stillFailedSet = new Set(stillFailed);
      setStagedFiles((prev) => prev.filter((file) => stillFailedSet.has(file)));
      setUploading(false);
      if (stillFailed.length > 0) {
        setUploadError(t('chat.uploadFailed', { count: stillFailed.length }));
        return;
      }
    }
    navigate(`/tickets/${ticket.id}`);
  };

  const errorMessage = createTicket.error ? getErrorMessage(createTicket.error) : undefined;

  return (
    <div className="flex h-full justify-center overflow-auto px-6 py-8">
      <div className="w-full max-w-lg">
        <Link to="/tickets" className="text-[12px] text-ink-subtle hover:text-brand-600">
          ← {t('ticketDetail.backToAll')}
        </Link>
        <h1 className="mt-1 font-display text-lg font-bold">{t('newTicket.title')}</h1>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-6"
          noValidate
        >
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('tickets.columnTitle')}
            </label>
            <input
              id="title"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('title')}
            />
            {errors.title && <p className="mt-1 text-xs text-priority-urgent">{errors.title.message}</p>}
          </div>

          <div>
            <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('newTicket.categoryLabel')}
            </label>
            <select
              id="categoryId"
              className="h-[38px] w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-brand-600"
              {...register('categoryId')}
            >
              <option value="">{t('newTicket.noCategoryOption')}</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {pickLocalized(category.name, category.nameUk, category.nameEn, i18n.language)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">
              {t('newTicket.descriptionLabel')}
            </label>
            <RichTextEditor editor={descriptionEditor} minHeight="7rem" maxHeight="18rem" showTable />
            {descriptionError && <p className="mt-1 text-xs text-priority-urgent">{descriptionError}</p>}
            <p className="mt-1 text-[11.5px] text-ink-faint">{t('chat.pasteScreenshotHint')}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">{t('newTicket.attachmentsLabel')}</label>
            {stagedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {stagedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-[12px]"
                  >
                    <span role="img" aria-label={t('chat.fileAria')}>
                      📎
                    </span>
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <span className="text-ink-faint">{formatFileSize(t, file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeStagedFile(index)}
                      aria-label={t('chat.removeFileAria', { name: file.name })}
                      className="text-ink-faint hover:text-priority-urgent"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline">
                <span role="img" aria-label={t('chat.attachFileAria')}>
                  📎
                </span>
                {t('chat.attachFiles')}
                <input type="file" multiple className="hidden" onChange={handleFileChange} disabled={isUploading} />
              </label>
              {!sizeError && <span className="text-[11.5px] text-ink-faint">{t('chat.attachmentSizeHint')}</span>}
            </div>
            {sizeError && <p className="mt-1 text-xs text-priority-urgent">{sizeError}</p>}
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{errorMessage}</p>
          )}
          {uploadError && (
            <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">
              {uploadError}{' '}
              {createdTicketRef.current && (
                <Link to={`/tickets/${createdTicketRef.current.id}`} className="font-medium underline">
                  {t('newTicket.goToTicket')}
                </Link>
              )}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/tickets')}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createTicket.isPending || isUploading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {createTicket.isPending
                ? t('newTicket.creating')
                : isUploading
                  ? t('newTicket.uploadingFiles')
                  : uploadError
                    ? t('newTicket.retryUpload')
                    : t('newTicket.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
