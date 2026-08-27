import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface MentionItem {
  id: string;
  label: string;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

// Imperative ref so the Tiptap suggestion plugin's onKeyDown (which lives
// outside React, in the ProseMirror keymap) can drive this list's selection
// without owning React state itself — the standard shape Tiptap's own
// Mention examples use for a ReactRenderer-mounted popup.
export const MentionList = forwardRef<MentionListRef, { items: MentionItem[]; command: (item: MentionItem) => void }>(
  function MentionList(props, ref) {
    const { t } = useTranslation();
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [props.items]);

    function selectItem(index: number) {
      const item = props.items[index];
      if (item) props.command(item);
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + props.items.length - 1) % props.items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % props.items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (props.items.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-surface-card px-3 py-2 text-[12.5px] text-ink-faint shadow-lg">
          {t('chat.nobodyFound')}
        </div>
      );
    }

    return (
      <div className="max-h-56 w-56 overflow-y-auto rounded-lg border border-border bg-surface-card py-1 shadow-lg">
        {props.items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectItem(index)}
            className={`block w-full truncate px-3 py-1.5 text-left text-[12.5px] ${
              index === selectedIndex ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-surface-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  },
);
