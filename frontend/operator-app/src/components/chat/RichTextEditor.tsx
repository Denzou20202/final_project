import { EditorContent, useEditorState, type Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';

function ToolbarButton({
  label,
  active,
  onClick,
  underlineLabel,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  underlineLabel?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-[12.5px] font-semibold ${underlineLabel ? 'underline' : ''} ${
        active ? 'bg-brand-100 text-brand-700' : 'text-ink-faint hover:bg-surface-muted'
      }`}
    >
      {label}
    </button>
  );
}

// editor.isActive(...) reflects the CURRENT state, but reading it directly
// in render doesn't cause a re-render when that state changes — Tiptap v3's
// useEditor no longer re-renders on every transaction by default (see
// shouldRerenderOnTransaction in @tiptap/react). useEditorState subscribes
// to exactly the marks/nodes this toolbar cares about, so the active
// highlight actually updates when the selection or formatting changes.
function Toolbar({
  editor,
  showTable,
  showImage,
  onInsertImage,
  showLink,
}: {
  editor: Editor;
  showTable: boolean;
  showImage: boolean;
  onInsertImage?: () => void;
  showLink: boolean;
}) {
  const { t } = useTranslation();
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      code: editor.isActive('code'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      link: editor.isActive('link'),
      // isActive on a node name the editor's own extensions never
      // registered (true for every RichTextEditor caller except
      // KnowledgeEditorPage) just returns false rather than throwing, so
      // this is safe even when showTable is false — still gated behind the
      // prop below anyway, for clarity rather than correctness.
      inTable: showTable && editor.isActive('table'),
    }),
  });

  // A bare prompt() for the URL — there's no other manual "insert a
  // hyperlink" affordance anywhere in the app yet (StarterKit's Link mark
  // otherwise only ever gets applied via autolink or the KB-article picker),
  // and the app already leans on native browser dialogs (window.confirm) for
  // this kind of one-off input rather than a dedicated modal.
  function insertLink() {
    const previousHref = editor.getAttributes('link')['href'] as string | undefined;
    const href = window.prompt(t('chat.linkPromptLabel'), previousHref ?? 'https://');
    if (href === null) return;
    if (href.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-0.5 border-b border-border-subtle pb-1.5">
      <ToolbarButton label={t('chat.toolbarBold')} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton label={t('chat.toolbarItalic')} active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton
        label="U"
        underlineLabel
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton label="</>" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()} />
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        label="•"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="1."
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="❝"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      {showLink && (
        <ToolbarButton label="🔗" title={t('chat.toolbarInsertLink')} active={state.link} onClick={insertLink} />
      )}
      {showImage && (
        <ToolbarButton label="🖼" title={t('chat.toolbarInsertImage')} active={false} onClick={() => onInsertImage?.()} />
      )}
      {showTable && (
        <>
          <span className="mx-1 h-4 w-px bg-border" />
          {!state.inTable && (
            <ToolbarButton
              label="▦"
              title={t('chat.toolbarInsertTable')}
              active={false}
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()}
            />
          )}
          {state.inTable && (
            <>
              <ToolbarButton
                label={t('chat.toolbarAddRowLabel')}
                title={t('chat.toolbarAddRow')}
                active={false}
                onClick={() => editor.chain().focus().addRowAfter().run()}
              />
              <ToolbarButton
                label={t('chat.toolbarAddColumnLabel')}
                title={t('chat.toolbarAddColumn')}
                active={false}
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              />
              <ToolbarButton
                label={t('chat.toolbarDeleteRowLabel')}
                title={t('chat.toolbarDeleteRow')}
                active={false}
                onClick={() => editor.chain().focus().deleteRow().run()}
              />
              <ToolbarButton
                label={t('chat.toolbarDeleteColumnLabel')}
                title={t('chat.toolbarDeleteColumn')}
                active={false}
                onClick={() => editor.chain().focus().deleteColumn().run()}
              />
              <ToolbarButton
                label="🗑"
                title={t('chat.toolbarDeleteTable')}
                active={false}
                onClick={() => editor.chain().focus().deleteTable().run()}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

// A purely presentational wrapper — the `editor` instance (extensions,
// content, submit-on-Enter handling) is owned by the caller via useEditor,
// since ChatPanel needs imperative access to it (macro insertion, switching
// content when editing a past message, clearing on send). minHeight/maxHeight
// are overridable because the knowledge-base article editor reuses this same
// component but needs a much taller writing area than a one-line chat reply.
// showTable reveals the table toolbar (insert / contextual row-column
// controls) — every caller that passes it also registers TableKit
// (Table/TableRow/TableHeader/TableCell as one extension) in its own
// `useEditor` call; passing showTable without it would insert a node the
// editor's schema doesn't know and silently no-op. showImage/showLink follow
// the same rule (caller must register the Image extension / StarterKit's
// Link mark respectively) — showImage additionally needs onInsertImage,
// since the upload itself (network call, error handling) stays owned by the
// caller, same as everything else this component doesn't own.
export function RichTextEditor({
  editor,
  minHeight = '3.5rem',
  maxHeight = '20rem',
  showTable = false,
  showImage = false,
  onInsertImage,
  showLink = false,
}: {
  editor: Editor | null;
  minHeight?: string;
  maxHeight?: string;
  showTable?: boolean;
  showImage?: boolean;
  onInsertImage?: () => void;
  showLink?: boolean;
}) {
  if (!editor) return null;

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-card px-3 py-2 focus-within:border-brand-600">
      <Toolbar editor={editor} showTable={showTable} showImage={showImage} onInsertImage={onInsertImage} showLink={showLink} />
      <EditorContent
        editor={editor}
        style={{ minHeight, maxHeight }}
        className="overflow-x-auto overflow-y-auto break-words text-[13.5px] leading-relaxed [&_.ProseMirror]:outline-none [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-ink-faint [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12.5px] [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-2 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_th]:border [&_th]:border-border [&_th]:bg-surface-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold"
      />
    </div>
  );
}
