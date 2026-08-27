import { KnowledgeArticleStatus } from '@veloxdesk/types';
import Image from '@tiptap/extension-image';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import type { EditorView } from '@tiptap/pm/view';
import { ReactRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { TFunction } from 'i18next';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useArticlesList } from '../../hooks/useArticles.js';
import { useAttachments, useUploadAttachment } from '../../hooks/useAttachments.js';
import { useCurrentUser } from '../../hooks/useAuth.js';
import { useChatRoom } from '../../hooks/useChatRoom.js';
import { useMacros } from '../../hooks/useMacros.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { useUserLookup } from '../../hooks/useUserLookup.js';
import {
  IMAGE_MIME_TYPES as INLINE_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES as MAX_INLINE_IMAGE_SIZE_BYTES,
  uploadArticleImage,
} from '../../lib/api/article-images.api.js';
import { clipboardHasTable } from '../../lib/clipboard.js';
import { getErrorMessage } from '../../lib/errors.js';
import { pickLocalized } from '../../lib/localized.js';
import type { PublicAttachment, PublicComment } from '../../lib/types.js';
import { useAttachmentRetryStore } from '../../store/attachment-retry.store.js';
import { useRecentActivityStore } from '../../store/recent-activity.store.js';
import { useSidebarHighlightStore } from '../../store/sidebar-highlight.store.js';
import { SplitToTicketModal } from '../tickets/SplitToTicketModal.js';
import { AttachmentInlineCard } from './AttachmentInlineCard.js';
import { MentionList, type MentionItem, type MentionListRef } from './MentionList.js';
import { MessageBubble } from './MessageBubble.js';
import { RichTextEditor } from './RichTextEditor.js';

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

// Substituted into a macro's body at insertion time — not stored anywhere,
// so editing an already-inserted reply never re-triggers a lookup.
const MACRO_PLACEHOLDERS: Record<string, keyof MacroPlaceholderValues> = {
  '{{client.fullName}}': 'clientName',
  '{{operator.fullName}}': 'operatorName',
  '{{ticket.number}}': 'ticketNumber',
};

interface MacroPlaceholderValues {
  clientName: string;
  operatorName: string;
  ticketNumber: string;
}

// Macro bodies are HTML now, inserted via editor.commands.insertContent(html)
// (which parses the string as HTML) — a client/operator display name can
// contain real `&`/`<`/`>` characters, so it must be escaped before being
// spliced into the HTML string, or it would corrupt the parsed structure.
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function applyMacroPlaceholders(body: string, values: MacroPlaceholderValues): string {
  let result = body;
  for (const [tag, key] of Object.entries(MACRO_PLACEHOLDERS)) {
    if (result.includes(tag)) result = result.split(tag).join(escapeHtml(values[key]));
  }
  return result;
}

type TimelineItem =
  | { kind: 'comment'; id: string; createdAt: string; comment: PublicComment }
  | { kind: 'attachment'; id: string; createdAt: string; attachment: PublicAttachment };

function formatFileSize(t: TFunction, bytes: number): string {
  if (bytes < 1024) return t('chat.fileSizeBytes', { count: bytes });
  if (bytes < 1024 * 1024) return t('chat.fileSizeKB', { count: (bytes / 1024).toFixed(1) });
  return t('chat.fileSizeMB', { count: (bytes / (1024 * 1024)).toFixed(1) });
}

// memo — TicketDetailPage refetches `useTicket` on every mutation (status/
// priority/assignee/team/SLA/watch, plus a blanket invalidation on every
// live ticket:notification for the ticket), but ChatPanel's own props
// (ticketId/clientId/ticketNumber/isClosed/isDeleted) only actually change
// when one of THOSE specific fields changes — without this memo, an
// unrelated priority edit re-rendered the entire message thread underneath
// it for no visible reason.
export const ChatPanel = memo(function ChatPanel({
  ticketId,
  clientId,
  ticketNumber,
  isClosed,
  isDeleted,
}: {
  ticketId: string;
  clientId: string;
  ticketNumber: number;
  isClosed: boolean;
  isDeleted: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { messages, typingUserId, viewerIds, sendMessage, editMessage, notifyTyping } = useChatRoom(ticketId);
  const { data: me } = useCurrentUser();
  const { data: macros } = useMacros();
  // Published only — never let an operator link a still-draft article, it
  // would 404 for the client. limit:100, single page, same tradeoff
  // useAssignableUsers already makes for a picker-style dropdown.
  const { data: articlesPage } = useArticlesList(KnowledgeArticleStatus.PUBLISHED, 100);
  const articles = useMemo(
    () => [...(articlesPage?.items ?? [])].sort((a, b) => a.title.localeCompare(b.title)),
    [articlesPage],
  );
  const clearRecentActivity = useRecentActivityStore((s) => s.clear);
  const clearSidebarHighlight = useSidebarHighlightStore((s) => s.clearTicket);
  // Actively viewing this ticket counts as "seen" — clears any stale
  // highlight left over from before it was opened, and re-clears whenever
  // a new message shows up (either party's, including one just sent from
  // here) so a reply that lands while this panel is already mounted
  // doesn't leave the sidebar/list lit for a ticket the operator is
  // looking straight at.
  useEffect(() => {
    clearRecentActivity(ticketId);
    clearSidebarHighlight(ticketId);
  }, [ticketId, messages.length, clearRecentActivity, clearSidebarHighlight]);
  const upload = useUploadAttachment(ticketId);
  const { data: attachments } = useAttachments(ticketId);
  const lookupUser = useUserLookup();
  const [editing, setEditing] = useState<PublicComment | null>(null);
  const [splitSource, setSplitSource] = useState<PublicComment | null>(null);
  const [mode, setMode] = useState<'reply' | 'comment'>('reply');
  const [isEmpty, setIsEmpty] = useState(true);
  const [sizeError, setSizeError] = useState<string | undefined>(undefined);
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState<string | undefined>(undefined);
  const [isSending, setSending] = useState(false);
  const setPendingRetry = useAttachmentRetryStore((s) => s.setPending);
  const clearPendingRetry = useAttachmentRetryStore((s) => s.clearPending);
  // Restores a still-failed upload from a previous mount of this same
  // ticket (see attachment-retry.store.ts) — without this, navigating away
  // before retrying a partial upload failure silently lost it: the comment
  // was already sent with fewer attachments than intended, and nothing
  // told the operator, since ChatPanel remounts fresh (key={ticket.id}) on
  // every ticket switch.
  const [stagedFiles, setStagedFiles] = useState<File[]>(
    () => useAttachmentRetryStore.getState().pending[ticketId]?.files ?? [],
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Carries the comment across a retry after a partial failure — sendMessage
  // already succeeded and is live in the thread, so retrying handleSubmit
  // must resume the attachment uploads against that same comment instead of
  // sending the text again (which used to duplicate it). Only `.id` is ever
  // read off this within handleSubmit, so restoring just that much from the
  // retry store (rather than the full PublicComment shape) is enough.
  const pendingCommentRef = useRef<PublicComment | null>(
    (() => {
      const commentId = useAttachmentRetryStore.getState().pending[ticketId]?.commentId;
      return commentId ? ({ id: commentId } as PublicComment) : null;
    })(),
  );

  // «Другие сотрудники» specifically — the client themselves is always in
  // this room too, but they're not who this indicator is for.
  const otherStaffViewers = viewerIds.filter((id) => id !== me?.id && id !== clientId);
  // Reciprocal of client-portal's operatorWatchingNow banner — lets staff
  // know the client is actively looking at this ticket right now.
  const clientViewing = viewerIds.includes(clientId);

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

  // The explicit «insert image» toolbar button — distinct from a clipboard
  // paste, which still stages the file as an attachment (see
  // editorProps.handlePaste below, unchanged). This uploads immediately and
  // drops the image inline, same mechanism as the macro/KB article editors.
  async function insertInlineImage(file: File) {
    if (!INLINE_IMAGE_MIME_TYPES.has(file.type)) return;
    if (file.size > MAX_INLINE_IMAGE_SIZE_BYTES) {
      setImageError(t('chat.inlineImageTooLarge'));
      return;
    }
    setImageError(undefined);
    try {
      const { url } = await uploadArticleImage(file);
      editor?.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      setImageError(getErrorMessage(err));
    }
  }

  function handleInsertImageClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = Array.from(INLINE_IMAGE_MIME_TYPES).join(',');
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void insertInlineImage(file);
    };
    input.click();
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
  });

  // @mentions are staff-only — tagging a client wouldn't make sense here
  // (see chat.service.ts, which drops mentions entirely from a client-
  // authored message too). The Mention extension's items() callback is
  // captured once at editor creation, so it can't close over fresh query
  // results directly — this ref is kept current by the effect below instead.
  const { data: assignableUsers } = useAssignableUsers();
  const staffMentionListRef = useRef<MentionItem[]>([]);
  useEffect(() => {
    staffMentionListRef.current = (assignableUsers?.items ?? [])
      .filter((user) => user.role !== 'client' && user.id !== me?.id && !user.deactivatedAt)
      .map((user) => ({ id: user.id, label: user.fullName }));
  }, [assignableUsers, me?.id]);

  // While the mention popup is open, Enter must select the highlighted
  // suggestion, not submit the message — without this flag, handleKeyDown
  // below intercepts Enter first and sends whatever's typed so far (with the
  // "@query" left as plain text) instead of ever letting the suggestion
  // plugin insert the mention node.
  const mentionPopupOpenRef = useRef(false);

  const mentionExtension = useMemo(
    () =>
      Mention.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            const q = query.toLowerCase();
            return staffMentionListRef.current.filter((user) => user.label.toLowerCase().includes(q)).slice(0, 8);
          },
          render: () => {
            let component: ReactRenderer<MentionListRef>;
            let unmount: (() => void) | undefined;
            return {
              onStart: (props) => {
                mentionPopupOpenRef.current = true;
                component = new ReactRenderer(MentionList, { props, editor: props.editor });
                unmount = props.mount(component.element as HTMLElement);
              },
              onUpdate: (props) => {
                component.updateProps(props);
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  mentionPopupOpenRef.current = false;
                  unmount?.();
                  return true;
                }
                return component.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                mentionPopupOpenRef.current = false;
                unmount?.();
                component.destroy();
              },
            };
          },
        },
      }),
    [],
  );

  // Mount-time-only seed for the placeholder text, same pattern as
  // KnowledgeEditorPage's — Tiptap doesn't react to a changed `extensions`
  // array on an already-mounted editor, so this only picks up the language
  // active when the panel first mounts. Kept in sync with
  // sanitizeCommentBody's allowlist on the backend — nothing this editor can
  // produce (bold/underline/italic/inline-code/lists/blockquote/mentions/
  // links/tables) ever gets stripped server-side. StarterKit bundles
  // Underline AND Link itself in Tiptap v3 (unlike v2), so no separate
  // import is needed — just openOnClick:false, since the default (true)
  // would otherwise try to actually navigate the moment a click lands on an
  // inserted article link while still composing, instead of just placing
  // the cursor. TableKit config mirrors KnowledgeEditorPage's own (resizing
  // disabled — see that page's comment on why).
  const baseExtensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        codeBlock: false,
        strike: false,
        link: { openOnClick: false },
      }),
      Placeholder.configure({ placeholder: t('chat.composerPlaceholder') }),
      // Required for a macro's inline <img> (see insertMacro below) to have
      // somewhere to parse into — without this, ProseMirror's HTML parser
      // just silently drops any <img> node the schema doesn't recognize.
      Image,
      TableKit.configure({ table: { resizable: false } }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const extensions = useMemo(() => [...baseExtensions, mentionExtension], [baseExtensions, mentionExtension]);

  // A fresh object literal here defeats Tiptap's own change-detection —
  // unlike onUpdate/onCreate (which @tiptap/react proxies through an
  // internal ref, so they're always "fresh" without needing memoization),
  // editorProps is compared by reference every render. An unmemoized one
  // made Tiptap call editor.setOptions()/view.setProps()/view.updateState()
  // on every single keystroke while composing — redundant ProseMirror view
  // work on top of Tiptap's own normal update, on the single most frequent
  // interaction in this app. `[]` deps is safe: both handlers only ever
  // reach back into the component via latestRef/mentionPopupOpenRef (both
  // refs, always current regardless of when the closure was created), never
  // a plain closed-over value that could go stale.
  const editorProps = useMemo(
    () => ({
      handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey && !mentionPopupOpenRef.current) {
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
        if (event.key === 'Escape' && latestRef.current.editing && !mentionPopupOpenRef.current) {
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
      if (editor.isEmpty) return;
      // Same re-entrancy guard as the send path below — Enter (handleKeyDown)
      // calls this function directly, bypassing the Save button's own
      // `disabled={!canSubmit}`.
      if (isSending) return;
      const html = editor.getHTML();
      if (html === editing.body) {
        // Nothing actually changed — close without round-tripping to the
        // server at all.
        setEditing(null);
        editor.commands.clearContent();
        return;
      }
      setSending(true);
      setSendError(undefined);
      try {
        // Await the ack instead of firing and forgetting — the dialog now
        // only closes once the edit is confirmed to have actually landed.
        // Closing immediately used to leave no trace of a failed edit: the
        // dialog would disappear as if it succeeded, and the bubble would
        // just keep showing the old text with nothing telling the operator
        // their change never saved (dropped connection, ticket closed out
        // from under them mid-edit, etc.).
        await editMessage(editing.id, html);
        setEditing(null);
        editor.commands.clearContent();
      } catch (err) {
        setSendError(getErrorMessage(err));
      } finally {
        setSending(false);
      }
      return;
    }

    // The submit button's own `disabled={!canSubmit}` doesn't protect this
    // function — Enter (handleKeyDown) calls it directly, bypassing the
    // button entirely. Without this guard, OS key-repeat (or just an
    // impatient double-Enter) re-enters mid-send: the editor's content is
    // only cleared after `sendMessage` resolves, so a second call while the
    // first is still in flight sees the same non-empty text and sends it
    // again as a duplicate message/comment.
    if (isSending) return;

    const textIsEmpty = editor.isEmpty;
    if (textIsEmpty && stagedFiles.length === 0) return;

    setSending(true);
    setSendError(undefined);
    try {
      const comment = pendingCommentRef.current ?? (await sendMessage(textIsEmpty ? '' : editor.getHTML(), mode === 'comment'));
      pendingCommentRef.current = comment;
      if (!textIsEmpty) editor.commands.clearContent();

      if (stagedFiles.length > 0) {
        const results = await Promise.allSettled(
          stagedFiles.map((file) => upload.mutateAsync({ file, commentId: comment.id })),
        );
        const stillFailed = stagedFiles.filter((_, i) => results[i].status === 'rejected');
        setStagedFiles(stillFailed);
        if (stillFailed.length > 0) {
          // Survives navigating away before retrying — see
          // attachment-retry.store.ts's own comment.
          setPendingRetry(ticketId, { commentId: comment.id, files: stillFailed });
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
      clearPendingRetry(ticketId);
    } catch (err) {
      setSendError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  latestRef.current = { submit: handleSubmit, cancelEditing, editing, notifyTyping, stageFiles };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length]);

  // useCallback (not a plain function) — passed straight through to
  // MessageBubble's memo as the onEdit prop, so it must stay referentially
  // stable across renders or the memo never actually skips a re-render.
  const startEditing = useCallback(
    (comment: PublicComment) => {
      setEditing(comment);
      editor?.commands.setContent(comment.body);
      editor?.commands.focus();
    },
    [editor],
  );

  const handleSplitToTicket = useCallback((comment: PublicComment) => setSplitSource(comment), []);

  // Files are staged locally (not uploaded) until Send is clicked — lets the
  // sender see what they attached, remove a wrong pick, and keep typing
  // before anything actually leaves the browser.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    stageFiles(files);
  }

  function removeStagedFile(index: number) {
    setStagedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Only relevant in the post-send retry case (pendingCommentRef set —
      // see handleSubmit) — keeps the persisted retry state (attachment-
      // retry.store.ts) from resurrecting a file the operator deliberately
      // gave up on. Pre-send staging never touches the store at all.
      if (pendingCommentRef.current) {
        if (next.length > 0) {
          setPendingRetry(ticketId, { commentId: pendingCommentRef.current.id, files: next });
        } else {
          clearPendingRetry(ticketId);
          // Giving up on every remaining failed file must also forget the
          // already-sent comment — otherwise the NEXT send silently reuses
          // it (comment = pendingCommentRef.current ?? sendMessage(...)),
          // discarding whatever new text the operator typed instead of
          // sending it as its own message. Pre-existing bug, not introduced
          // by this fix, but directly adjacent to it.
          pendingCommentRef.current = null;
        }
      }
      return next;
    });
  }

  function insertMacro(macroId: string) {
    const macro = macros?.find((m) => m.id === macroId);
    if (!macro || !editor) return;
    const body = applyMacroPlaceholders(macro.body, {
      clientName: lookupUser(clientId),
      operatorName: me?.fullName ?? '—',
      ticketNumber: `#${ticketNumber}`,
    });
    // Macro bodies are HTML now (Tiptap's getHTML() output, same shape
    // sanitizeCommentBody allows) — insertContent parses a string as HTML by
    // default, so this also carries over any image/link/table the macro has.
    editor.chain().focus('end').run();
    editor.commands.insertContent(body);
    editor.commands.focus('end');
  }

  // Inserts a link to the article's page in client-portal's public FAQ
  // (`/faq/:id`, see FaqArticlePage) — root-relative, since operator-app and
  // client-portal share one domain (see nginx.prod.conf). The href only
  // ever survives the backend round-trip if it matches this exact shape
  // (see sanitizeCommentBody's KB_ARTICLE_HREF_RE) — anything else gets
  // downgraded to plain text server-side regardless of what the editor sent.
  function insertArticle(articleId: string) {
    const article = articles.find((a) => a.id === articleId);
    if (!article || !editor) return;
    const node = {
      type: 'text',
      text: article.title,
      marks: [{ type: 'link', attrs: { href: `/faq/${article.id}` } }],
    };
    editor.chain().focus('end').run();
    if (editor.isEmpty) {
      editor.commands.insertContent(node);
    } else {
      editor.commands.insertContent([{ type: 'paragraph', content: [node] }]);
    }
    editor.commands.focus('end');
  }

  const composerError = sizeError ?? sendError ?? imageError ?? (upload.error ? getErrorMessage(upload.error) : undefined);
  // isSending now doubles as "an edit save is in flight" too (see handleSubmit's
  // editing branch) — without it here, the Save button stayed clickable (and
  // Enter stayed live) for the whole round trip, same class of bug as the one
  // already fixed for the plain send path below.
  const canSubmit = editing ? !isEmpty && !isSending : (!isEmpty || stagedFiles.length > 0) && !isSending;

  return (
    <div className="flex h-full flex-col">
      {otherStaffViewers.length > 0 && (
        <div className="flex-none border-b border-border bg-brand-50 px-6 py-1.5 text-[12px] text-brand-700">
          {t('chat.watchingNow', { names: otherStaffViewers.map((id) => lookupUser(id)).join(', ') })}
        </div>
      )}
      {clientViewing && (
        <div className="flex-none border-b border-border bg-brand-50 px-6 py-1.5 text-[12px] text-brand-700">
          {t('chat.clientWatchingNow')}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-3">
          {timeline.map((item) =>
            item.kind === 'comment' ? (
              <MessageBubble
                key={item.id}
                comment={item.comment}
                attachments={attachmentsByComment.get(item.comment.id) ?? EMPTY_ATTACHMENTS}
                fromClient={item.comment.authorId === clientId}
                canEdit={item.comment.authorId === me?.id}
                onEdit={startEditing}
                onSplitToTicket={handleSplitToTicket}
              />
            ) : (
              <AttachmentInlineCard
                key={item.id}
                attachment={item.attachment}
                fromClient={item.attachment.uploaderId === null ? null : item.attachment.uploaderId === clientId}
                uploaderName={item.attachment.uploaderId ? lookupUser(item.attachment.uploaderId) : t('chat.unknownUploader')}
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
        {typingUserId && (
          <div className="mb-1.5 text-[12px] font-medium text-brand-700">
            {t('chat.typingIndicator', { name: lookupUser(typingUserId) })}
          </div>
        )}
        {editing && (
          <div className="mb-1.5 flex items-center gap-2 text-[12px] text-ink-muted">
            <span className="font-medium text-brand-700">{t('chat.editingMessage')}</span>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSending}
              className="text-ink-subtle hover:text-priority-urgent disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}
        {!editing && (
          <div className="mb-2 flex gap-1 border-b border-border-subtle">
            <button
              type="button"
              onClick={() => setMode('reply')}
              className={`border-b-2 px-1 pb-1.5 text-[13px] font-medium ${
                mode === 'reply' ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-faint'
              }`}
            >
              {t('chat.replyTab')}
            </button>
            <button
              type="button"
              onClick={() => setMode('comment')}
              className={`border-b-2 px-1 pb-1.5 text-[13px] font-medium ${
                mode === 'comment' ? 'border-priority-medium text-priority-medium' : 'border-transparent text-ink-faint'
              }`}
            >
              {t('chat.commentTab')}
            </button>
          </div>
        )}
        {!editing && mode === 'comment' && (
          <div className="mb-1.5 text-[11.5px] text-ink-faint">{t('chat.commentOnlyStaffHint')}</div>
        )}
        {!editing && ((macros && macros.length > 0) || articles.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {macros && macros.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) insertMacro(e.target.value);
                  e.target.value = '';
                }}
                className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-muted outline-none focus:border-brand-600"
              >
                <option value="">{t('chat.insertMacroPlaceholder')}</option>
                {macros.map((macro) => (
                  <option key={macro.id} value={macro.id}>
                    {pickLocalized(macro.title, macro.titleUk, macro.titleEn, i18n.language)}
                  </option>
                ))}
              </select>
            )}
            {articles.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) insertArticle(e.target.value);
                  e.target.value = '';
                }}
                className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-muted outline-none focus:border-brand-600"
              >
                <option value="">{t('chat.insertArticlePlaceholder')}</option>
                {articles.map((article) => (
                  <option key={article.id} value={article.id}>
                    {pickLocalized(article.title, article.titleUk, article.titleEn, i18n.language)}
                  </option>
                ))}
              </select>
            )}
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
          <RichTextEditor editor={editor} showTable showImage onInsertImage={handleInsertImageClick} showLink />
          <button
            type="submit"
            disabled={!canSubmit}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40 ${
              !editing && mode === 'comment' ? 'bg-priority-medium hover:opacity-90' : 'bg-brand-600 hover:bg-brand-hover'
            }`}
          >
            {editing
              ? isSending
                ? t('common.saving')
                : t('common.save')
              : isSending
                ? t('chat.sending')
                : mode === 'comment'
                  ? t('chat.addComment')
                  : t('chat.send')}
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

      {splitSource && (
        <SplitToTicketModal
          clientId={clientId}
          sourceBody={splitSource.body}
          onClose={() => setSplitSource(null)}
        />
      )}
    </div>
  );
});
