import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import type { EditorView } from '@tiptap/pm/view';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAttachments, useUploadAttachment } from '../../hooks/useAttachments.js';
import { useChatRoom } from '../../hooks/useChatRoom.js';
import { useCsat, useSubmitCsat } from '../../hooks/useTickets.js';
import { clipboardHasTable } from '../../lib/clipboard.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicAttachment, PublicComment, PublicCsatQuestionOption } from '../../lib/types.js';
import { useRecentActivityStore } from '../../store/recent-activity.store.js';
import { useSidebarHighlightStore } from '../../store/sidebar-highlight.store.js';
import { AttachmentInlineCard } from './AttachmentInlineCard.js';
import { MessageBubble } from './MessageBubble.js';
import { RichTextEditor } from './RichTextEditor.js';
import { CsatModal } from '../csat/CsatModal.js';
import { CsatSummary } from '../csat/CsatSummary.js';

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

const EMPTY_ATTACHMENTS: PublicAttachment[] = [];

type TimelineItem =
  | { kind: 'comment'; id: string; createdAt: string; comment: PublicComment }
  | { kind: 'attachment'; id: string; createdAt: string; attachment: PublicAttachment };

function formatFileSize(t: TFunction, bytes: number): string {
  if (bytes < 1024) return t('chat.fileSizeBytes', { count: bytes });
  if (bytes < 1024 * 1024) return t('chat.fileSizeKB', { count: (bytes / 1024).toFixed(1) });
  return t('chat.fileSizeMB', { count: (bytes / (1024 * 1024)).toFixed(1) });
}

export function ChatPanel({
  ticketId,
  myUserId,
  isClosed,
  isDeleted,
}: {
  ticketId: string;
  myUserId: string;
  isClosed: boolean;
  isDeleted: boolean;
}) {
  const { t } = useTranslation();
  const { messages, operatorTyping, viewerIds, sendMessage, editMessage, notifyTyping } = useChatRoom(ticketId);
  // Any viewer that isn't this client themselves is staff — a ticket room
  // only ever has its one creating client plus whichever operators/admins
  // have it open, so there's no name to show (and none should be, per the
  // client-facing wording) — just the fact that someone on the team is
  // looking right now. Mirrors operator-app's otherStaffViewers, minus
  // per-name detail.
  const operatorViewing = viewerIds.some((id) => id !== myUserId);
  const clearRecentActivity = useRecentActivityStore((s) => s.clear);
  const clearSidebarHighlight = useSidebarHighlightStore((s) => s.clearTicket);
  // Actively viewing this ticket counts as "seen" — clears any stale
  // highlight left over from before it was opened, and re-clears whenever
  // a new message shows up (either party's, including one just sent from
  // here) so a reply that lands while this panel is already mounted
  // doesn't leave the sidebar/list lit for a ticket the user is looking
  // straight at.
  useEffect(() => {
    clearRecentActivity(ticketId);
    clearSidebarHighlight(ticketId);
  }, [ticketId, messages.length, clearRecentActivity, clearSidebarHighlight]);
  const upload = useUploadAttachment(ticketId);
  const { data: attachments } = useAttachments(ticketId);
  const { data: csat } = useCsat(ticketId, isClosed && !isDeleted);
  const submitCsat = useSubmitCsat(ticketId);
  const [isCsatModalOpen, setCsatModalOpen] = useState(false);
  // Snapshotted at open time rather than read live from `csat.questions`:
  // submitting the survey invalidates the same query, flipping
  // csat.status to 'submitted' (which also drops `questions` from the
  // response) while the modal is still meant to be showing its thank-you
  // screen. Keying the modal's mount off this snapshot instead of live
  // query state stops the parent from unmounting it out from under itself.
  const [csatModalQuestions, setCsatModalQuestions] = useState<PublicCsatQuestionOption[] | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<PublicComment | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [sizeError, setSizeError] = useState<string | undefined>(undefined);
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const [isSending, setSending] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Carries the comment across a retry after a partial failure — sendMessage
  // already succeeded and is live in the thread, so retrying handleSubmit
  // must resume the attachment uploads against that same comment instead of
  // sending the text again (which used to duplicate it).
  const pendingCommentRef = useRef<PublicComment | null>(null);

  // Attachments linked to a comment (commentId set) render bundled inside
  // that MessageBubble, not as their own timeline entry — grouping them
  // here once avoids an O(messages × attachments) filter per render.
  const attachmentsByComment = useMemo(() => {
    const map = new Map<string, PublicAttachment[]>();
    for (const attachment of attachments ?? []) {
      if (!attachment.commentId) continue;
      const list = map.get(attachment.commentId);
      if (list) list.push(attachment);
      else map.set(attachment.commentId, [attachment]);
    }
    return map;
  }, [attachments]);

  // Only unlinked attachments (commentId null — historical rows from before
  // this column existed, or ticket-creation-time uploads) need their own
  // timeline slot; everything sent through the composer is already bundled
  // into its message above.
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...messages.map((comment): TimelineItem => ({
        kind: 'comment',
        id: comment.id,
        createdAt: comment.createdAt,
        comment,
      })),
      ...(attachments ?? [])
        .filter((attachment) => attachment.commentId === null)
        .map((attachment): TimelineItem => ({
          kind: 'attachment',
          id: attachment.id,
          createdAt: attachment.createdAt,
          attachment,
        })),
    ];
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return items;
  }, [messages, attachments]);

  function cancelEditing() {
    setEditing(null);
    editor?.commands.clearContent();
  }

  // Shared by the file-picker input and clipboard-paste handling below —
  // both just add to the same staging list, no upload until Send.
  function stageFiles(files: File[]) {
    if (files.length === 0) return;
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

  // onUpdate/handleKeyDown/handlePaste below are bound once, at editor
  // creation — they must never read component state/props directly (stale
  // closure). Routing every dynamic read through this ref, refreshed every
  // render, keeps them correct regardless of when Tiptap actually invokes
  // the callbacks.
  const latestRef = useRef({
    submit: () => undefined as void,
    cancelEditing,
    editing: editing as PublicComment | null,
    notifyTyping,
    stageFiles: (_files: File[]) => undefined as void,
    isSending: false,
  });

  // Mount-time-only seed for the placeholder text — Tiptap doesn't react to
  // a changed `extensions` array on an already-mounted editor, so this only
  // picks up the language active when the panel first mounts. Kept in sync
  // with sanitizeCommentBody's allowlist on the backend — nothing this
  // editor can produce ever gets stripped server-side. Identical to
  // operator-app's copy (see the note there) minus macro insertion/
  // mentions, which are staff-only. StarterKit bundles Underline itself in
  // Tiptap v3 (unlike v2) — no separate import needed. TableKit config
  // mirrors KnowledgeEditorPage's own (resizing disabled — see that page's
  // comment on why).
  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: false, horizontalRule: false, codeBlock: false, strike: false }),
      Placeholder.configure({ placeholder: t('chat.composerPlaceholder') }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // A fresh object literal here defeats Tiptap's own change-detection —
  // unlike onUpdate/onCreate (which @tiptap/react proxies through an
  // internal ref, so they're always "fresh" without needing memoization),
  // editorProps is compared by reference every render. An unmemoized one
  // made Tiptap call editor.setOptions()/view.setProps()/view.updateState()
  // on every single keystroke while composing — redundant ProseMirror view
  // work on top of Tiptap's own normal update, on the single most frequent
  // interaction in the app. `[]` deps is safe because both handlers only
  // ever reach back into the component via latestRef, never a closed-over
  // value that could go stale.
  const editorProps = useMemo(
    () => ({
      handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          // Inside a list, Enter belongs to ProseMirror: it splits the
          // current item (and lifts out of the list when the item is
          // empty). Intercepting it here would send the message on the
          // very first Enter, making a second list item impossible to type.
          // Same reasoning for a table cell — Enter there just breaks a new
          // paragraph inside the cell, same as it would in a normal
          // paragraph outside a table; without this it would send the
          // whole message on the first Enter typed into a cell.
          const { $from } = view.state.selection;
          for (let depth = $from.depth; depth > 0; depth--) {
            const nodeType = $from.node(depth).type.name;
            if (nodeType === 'listItem' || nodeType === 'tableCell' || nodeType === 'tableHeader') {
              return false;
            }
          }
          event.preventDefault();
          latestRef.current.submit();
          return true;
        }
        if (event.key === 'Escape' && latestRef.current.editing) {
          latestRef.current.cancelEditing();
          return true;
        }
        return false;
      },
      // A screenshot copied to the clipboard (Cmd+Shift+4, Snipping Tool,
      // etc.) pastes here as image clipboard data, not text — stage it the
      // same way the file picker does instead of letting ProseMirror try to
      // insert it as an editor node (StarterKit has no image support, so a
      // raw image paste would otherwise just be silently dropped). Excel/
      // Sheets puts BOTH a bitmap AND a real <table> on the clipboard when
      // copying a range — clipboardHasTable bails out first so that case
      // falls through to ProseMirror's own paste handling (a real table via
      // TableKit) instead of degrading into a flat picture attachment.
      handlePaste: (_view: EditorView, event: ClipboardEvent) => {
        // The editor is also made non-editable (see the setEditable effect
        // below) while a send is in flight, which already blocks ProseMirror
        // from acting on a paste — this is a second, explicit line of
        // defense so a paste that somehow still reaches here (e.g. a paste
        // event that landed a tick before setEditable(false) took effect)
        // can't get staged into a stagedFiles snapshot that handleSubmit's
        // in-flight async continuation will silently overwrite when it
        // resolves. See handleSubmit's comment on why that overwrite is
        // otherwise unsafe.
        if (latestRef.current.isSending) return true;
        if (clipboardHasTable(event)) return false;
        const files = Array.from(event.clipboardData?.items ?? [])
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null && IMAGE_MIME_TYPES.has(file.type));
        if (files.length === 0) return false;
        event.preventDefault();
        latestRef.current.stageFiles(files);
        return true;
      },
    }),
    [],
  );

  const editor = useEditor({
    extensions,
    content: '',
    onUpdate: ({ editor }) => {
      setIsEmpty(editor.isEmpty);
      if (!latestRef.current.editing) latestRef.current.notifyTyping();
    },
    editorProps,
  });

  // Keeps the composer fully interactive during a send from letting new
  // input (typed text, a pasted screenshot, an Edit click on another
  // message) collide with handleSubmit's async continuation, which resolves
  // holding a stale pre-await snapshot of the editor/stagedFiles and would
  // otherwise silently clobber whatever landed in the meantime. Imperative
  // setEditable, not a declarative `editable` option on useEditor — Tiptap's
  // own onRender always re-applies editable from the editor's OWN current
  // isEditable rather than from fresh options on every render (see
  // EditorInstanceManager.onRender in @tiptap/react), so a reactive
  // `editable` prop would never actually take effect here.
  useEffect(() => {
    editor?.setEditable(!isSending);
  }, [editor, isSending]);

  // Text and files are sent as one action: the message goes out first (its
  // id comes back via the socket ack), then every staged file uploads with
  // that id attached, in parallel. The text send itself is NOT retried on a
  // partial failure — it already happened and is live in the thread —
  // pendingCommentRef carries the resulting comment across a retry so only
  // the still-outstanding uploads run again. Files that uploaded
  // successfully are dropped from stagedFiles immediately rather than
  // re-sent, so a retry only touches what actually still failed.
  async function handleSubmit() {
    if (!editor) return;

    if (editing) {
      // Same re-entrancy guard as the send path below — Enter bypasses the
      // submit button's own `disabled`, and the editor stays populated
      // (and, until the setEditable effect above catches up, editable)
      // until editMessage's ack actually lands.
      if (isSending) return;
      if (editor.isEmpty) return;
      const html = editor.getHTML();
      if (html === editing.body) {
        setEditing(null);
        editor.commands.clearContent();
        return;
      }
      setSending(true);
      setSendError(undefined);
      try {
        await editMessage(editing.id, html);
        setEditing(null);
        editor.commands.clearContent();
      } catch (error) {
        // Leave the editor open with the in-progress edit intact — same
        // "don't lose what the user typed" treatment as a failed send below.
        setSendError(getErrorMessage(error));
      } finally {
        setSending(false);
      }
      return;
    }

    // The submit button's own `disabled={!canSubmit}` doesn't protect this
    // function — Enter (handleKeyDown above) calls it directly, bypassing
    // the button entirely. Without this guard, OS key-repeat (or just an
    // impatient double-Enter) re-enters mid-send: the editor's content is
    // only cleared after `sendMessage` resolves, so a second call while the
    // first is still in flight sees the same non-empty text and sends it
    // again as a duplicate message.
    if (isSending) return;

    const textIsEmpty = editor.isEmpty;
    if (textIsEmpty && stagedFiles.length === 0) return;

    setSending(true);
    setSendError(undefined);
    try {
      const comment = pendingCommentRef.current ?? (await sendMessage(textIsEmpty ? '' : editor.getHTML()));
      pendingCommentRef.current = comment;
      if (!textIsEmpty) editor.commands.clearContent();

      if (stagedFiles.length > 0) {
        const results = await Promise.allSettled(
          stagedFiles.map((file) => upload.mutateAsync({ file, commentId: comment.id })),
        );
        const stillFailed = stagedFiles.filter((_, i) => results[i].status === 'rejected');
        // Functional update rather than the plain overwrite this used to be:
        // stagedFiles above is a pre-await snapshot, and even with staging
        // now blocked while isSending (see the setEditable effect and
        // handlePaste's guard) this keeps the update correct against
        // `prev` instead of silently discarding anything that isn't in that
        // stale snapshot.
        const stillFailedSet = new Set(stillFailed);
        setStagedFiles((prev) => prev.filter((file) => stillFailedSet.has(file)));
        if (stillFailed.length > 0) {
          // A single failure shows its *actual* reason (too large, wrong
          // type, ...) via getErrorMessage — throwing a plain Error here
          // used to defeat that entirely, since getErrorMessage only reads
          // .response.data off a real AxiosError and silently falls back to
          // the generic "something went wrong" for anything else, including
          // an Error it was handed deliberately. Several failures at once
          // fall back to the count message — several different reasons
          // wouldn't fit in one line anyway.
          const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
          setSendError(
            stillFailed.length === 1 && firstFailure
              ? getErrorMessage(firstFailure.reason)
              : t('chat.uploadFailed', { count: stillFailed.length }),
          );
          return;
        }
      }

      pendingCommentRef.current = null;
    } catch (err) {
      setSendError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  latestRef.current = { submit: handleSubmit, cancelEditing, editing, notifyTyping, stageFiles, isSending };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length]);

  function startEditing(comment: PublicComment) {
    // Loads `comment` into the same shared editor instance handleSubmit is
    // using for the in-flight send — colliding with its post-await
    // clearContent() would wipe the edit right back out. The Edit button
    // itself is also disabled below while isSending, this is the no-op
    // backstop for any other path that could reach here.
    if (isSending) return;
    setEditing(comment);
    editor?.commands.setContent(comment.body);
    editor?.commands.focus();
  }

  // Files are staged locally (not uploaded) until Send is clicked — lets the
  // sender see what they attached, remove a wrong pick, and keep typing
  // before anything actually leaves the browser.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    stageFiles(files);
  }

  function removeStagedFile(index: number) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const composerError = sizeError ?? sendError ?? (upload.error ? getErrorMessage(upload.error) : undefined);
  const canSubmit = editing ? !isEmpty : (!isEmpty || stagedFiles.length > 0) && !isSending;

  const csatQuestionsAvailable = csat?.status === 'pending' && csat.questions && csat.questions.length > 0;

  return (
    <div className="flex h-full flex-col">
      {operatorViewing && (
        <div className="flex-none border-b border-border bg-brand-50 px-6 py-1.5 text-[12px] text-brand-700">
          {t('chat.operatorWatchingNow')}
        </div>
      )}
      {isClosed && !isDeleted && csatQuestionsAvailable && (
        // Deliberately placed here — right under the header, above the
        // scrollable message list — rather than tucked into the footer below
        // the composer: the client asked to rate right after closure, so the
        // ask needs to be the first thing they see, not something they have
        // to scroll past every message to find.
        <div className="flex-none border-b border-brand-600/30 bg-brand-50 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl" aria-hidden="true">
                ⭐
              </span>
              <div>
                <div className="text-[13.5px] font-bold text-brand-700">{t('csat.bannerPrompt')}</div>
                <div className="text-[12px] text-brand-700/80">{t('csat.bannerSubtitle')}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (csat?.questions) {
                  setCsatModalQuestions(csat.questions);
                  setCsatModalOpen(true);
                }
              }}
              className="flex-none rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
            >
              {t('csat.bannerButton')}
            </button>
          </div>
        </div>
      )}
      {isClosed && !isDeleted && csat?.status === 'submitted' && (
        <CsatSummary answers={csat.answers ?? []} submittedAt={csat.submittedAt} />
      )}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-3">
          {timeline.map((item) =>
            item.kind === 'comment' ? (
              <MessageBubble
                key={item.id}
                comment={item.comment}
                attachments={attachmentsByComment.get(item.comment.id) ?? EMPTY_ATTACHMENTS}
                isMine={item.comment.authorId === myUserId}
                onEdit={() => startEditing(item.comment)}
                editDisabled={isSending}
              />
            ) : (
              <AttachmentInlineCard
                key={item.id}
                attachment={item.attachment}
                isMine={item.attachment.uploaderId === null ? null : item.attachment.uploaderId === myUserId}
              />
            ),
          )}
          {timeline.length === 0 && (
            <div className="py-10 text-center text-[13px] text-ink-faint">{t('chat.noConversationYet')}</div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {isClosed || isDeleted ? (
        <div className="flex-none border-t border-border bg-surface-muted px-6 py-3 text-center text-[13px] text-ink-faint">
          {isDeleted ? t('chat.deletedNotice') : t('chat.closedNotice')}
        </div>
      ) : (
      <div className="flex-none border-t border-border bg-surface-card px-6 py-3">
        {operatorTyping && <div className="mb-1.5 text-[12px] font-medium text-brand-700">{t('chat.operatorTyping')}</div>}
        {editing && (
          <div className="mb-1.5 flex items-center gap-2 text-[12px] text-ink-muted">
            <span className="font-medium text-brand-700">{t('chat.editingMessage')}</span>
            <button type="button" onClick={cancelEditing} className="text-ink-subtle hover:text-priority-urgent">
              {t('common.cancel')}
            </button>
          </div>
        )}
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
                  disabled={isSending}
                  aria-label={t('chat.removeFileAria', { name: file.name })}
                  className="text-ink-faint hover:text-priority-urgent disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            latestRef.current.submit();
          }}
          className="flex items-end gap-2"
        >
          <RichTextEditor editor={editor} showTable />
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-40"
          >
            {editing ? t('common.save') : isSending ? t('chat.sending') : t('chat.send')}
          </button>
        </form>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="flex items-center gap-1 text-[12.5px] font-medium text-ink-subtle hover:text-brand-600 disabled:opacity-50"
          >
            <span role="img" aria-label={t('chat.attachFileAria')}>
              📎
            </span>{' '}
            {t('chat.attachFiles')}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          {!composerError && (
            <span className="text-[11.5px] text-ink-faint">
              {t('chat.pasteScreenshotHint')} · {t('chat.attachmentSizeHint')}
            </span>
          )}
          {composerError && <span className="text-[12px] text-priority-urgent">{composerError}</span>}
        </div>
      </div>
      )}

      {isCsatModalOpen && csatModalQuestions && (
        <CsatModal
          questions={csatModalQuestions}
          onClose={() => {
            setCsatModalOpen(false);
            setCsatModalQuestions(undefined);
          }}
          onSubmit={async (answers) => {
            await submitCsat.mutateAsync(answers);
          }}
        />
      )}
    </div>
  );
}
