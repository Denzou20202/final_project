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
function Toolbar({ editor, showTable }: { editor: Editor; showTable: boolean }) {
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
      // isActive on a node name the editor's own extensions never
      // registered just returns false rather than throwing, so this is
      // safe even when showTable is false — still gated behind the prop
      // below anyway, for clarity rather than correctness.
      inTable: showTable && editor.isActive('table'),
    }),
  });

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
                label="+Р"
                title={t('chat.toolbarAddRow')}
                active={false}
                onClick={() => editor.chain().focus().addRowAfter().run()}
              />
              <ToolbarButton
                label="+К"
                title={t('chat.toolbarAddColumn')}
                active={false}
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              />
              <ToolbarButton
                label="−Р"
                title={t('chat.toolbarDeleteRow')}
                active={false}
                onClick={() => editor.chain().focus().deleteRow().run()}
              />
              <ToolbarButton
                label="−К"
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
// since ChatPanel needs imperative access to it (switching content when
// editing a past message, clearing on send). Kept identical to
// operator-app's copy — the two apps share no component library yet, so
// this is a deliberate duplicate, not a fork. minHeight/maxHeight are
// overridable because NewTicketPage reuses this same component but needs a
// taller writing area than a one-line chat reply. showTable reveals the
// table toolbar (insert / contextual row-column controls) — the caller's
// own `useEditor` call must register TableKit for it to do anything.
export function RichTextEditor({
  editor,
  minHeight = '3.5rem',
  maxHeight = '20rem',
  showTable = false,
}: {
  editor: Editor | null;
  minHeight?: string;
  maxHeight?: string;
  showTable?: boolean;
}) {
  if (!editor) return null;

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-card px-3 py-2 focus-within:border-brand-600">
      <Toolbar editor={editor} showTable={showTable} />
      <EditorContent
        editor={editor}
        style={{ minHeight, maxHeight }}
        className="overflow-x-auto overflow-y-auto break-words text-[13.5px] leading-relaxed [&_.ProseMirror]:outline-none [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-ink-faint [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12.5px] [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-2 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_th]:border [&_th]:border-border [&_th]:bg-surface-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold"
      />
    </div>
  );
}
