import { CustomFieldType } from '@veloxdesk/types';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadAttachment, useAttachments, useUploadAttachment } from '../../hooks/useAttachments.js';
import { useCustomFieldDefinitions, useSetTicketCustomFieldValue, useTicketCustomFieldValues } from '../../hooks/useCustomFields.js';
import { pickLocalized } from '../../lib/localized.js';
import type { PublicAttachment, PublicCustomFieldDefinition } from '../../lib/types.js';

// Grows with content instead of scrolling internally — no library needed,
// just resetting height to 'auto' before reading scrollHeight (the standard
// two-step trick: without the reset, scrollHeight only ever grows, never
// shrinks back down when text is deleted).
function AutoGrowTextarea({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="w-full resize-none overflow-hidden rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none"
    />
  );
}

function FileFieldInput({
  ticketId,
  value,
  attachmentsById,
  onCommit,
}: {
  ticketId: string;
  value: string;
  attachmentsById: Map<string, PublicAttachment>;
  onCommit: (value: string) => void;
}) {
  const { t } = useTranslation();
  const upload = useUploadAttachment(ticketId);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachment = value ? attachmentsById.get(value) : undefined;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const uploaded = await upload.mutateAsync({ file });
    onCommit(uploaded.id);
  }

  return (
    <div className="flex items-center gap-2">
      {attachment ? (
        <button
          type="button"
          onClick={() => void downloadAttachment(attachment.id, attachment.fileName)}
          className="min-w-0 flex-1 truncate rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-left text-[13px] text-brand-600 hover:underline"
        >
          <span role="img" aria-label={t('chat.fileAria')}>
            📎
          </span>{' '}
          {attachment.fileName}
        </button>
      ) : (
        <span className="flex-1 text-[12.5px] text-ink-faint">{t('customFields.noFileYet')}</span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="flex-none rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-50"
      >
        {upload.isPending ? t('common.saving') : attachment ? t('customFields.replaceFile') : t('customFields.uploadFile')}
      </button>
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => void handleFileChange(e)} />
    </div>
  );
}

// memo — a ticket can have several custom fields stacked in this section;
// without this, committing (or auto-clearing, see the effect below)
// ONE field's value re-rendered every sibling field's input too, since
// useSetTicketCustomFieldValue's success handler invalidates the whole
// values list for the ticket. Only pays off because onCommit below is a
// single stable callback shared by every field (not a fresh closure per
// field per render) — see CustomFieldsSection's handleCommitValue.
const FieldInput = memo(function FieldInput({
  field,
  value,
  ticketId,
  attachmentsById,
  onCommit,
}: {
  field: PublicCustomFieldDefinition;
  value: string;
  ticketId: string;
  attachmentsById: Map<string, PublicAttachment>;
  onCommit: (fieldId: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (field.fieldType === CustomFieldType.CHECKBOX) {
    return (
      <input
        type="checkbox"
        checked={draft === 'true'}
        onChange={(e) => {
          const next = e.target.checked ? 'true' : 'false';
          setDraft(next);
          onCommit(field.id, next);
        }}
        className="h-4 w-4 rounded border-border accent-brand-600"
      />
    );
  }

  if (field.fieldType === CustomFieldType.FILE) {
    return (
      <FileFieldInput
        ticketId={ticketId}
        value={draft}
        attachmentsById={attachmentsById}
        onCommit={(value) => onCommit(field.id, value)}
      />
    );
  }

  if (field.fieldType === CustomFieldType.TEXTAREA) {
    return (
      <AutoGrowTextarea
        value={draft}
        onChange={setDraft}
        onBlur={() => {
          if (draft !== value) onCommit(field.id, draft);
        }}
      />
    );
  }

  if (field.fieldType === CustomFieldType.SELECT) {
    return (
      <select
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onCommit(field.id, e.target.value);
        }}
        className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none"
      >
        <option value="">—</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  const invalid =
    field.fieldType === CustomFieldType.REGEX && draft !== '' && field.pattern && !new RegExp(field.pattern).test(draft);

  return (
    <div>
      <input
        type={field.fieldType === CustomFieldType.NUMBER ? 'number' : field.fieldType === CustomFieldType.DATE ? 'date' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value && !invalid) onCommit(field.id, draft);
        }}
        className={`w-full rounded-lg border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none ${
          invalid ? 'border-priority-urgent' : 'border-border'
        }`}
      />
    </div>
  );
});

export function CustomFieldsSection({ ticketId }: { ticketId: string }) {
  const { t, i18n } = useTranslation();
  const { data: definitions } = useCustomFieldDefinitions();
  const { data: values } = useTicketCustomFieldValues(ticketId);
  const { data: attachments } = useAttachments(ticketId);
  const setValue = useSetTicketCustomFieldValue(ticketId);

  // useMemo, not a plain `new Map(...)` on every render — this feeds
  // FieldInput's memo (see above); a fresh Map identity every render would
  // be harmless for FieldInput itself (it reads values out, doesn't diff
  // the Map), but attachmentsById is passed straight through as a prop, so
  // a fresh identity there defeated the memo entirely.
  const valueByField = useMemo(() => new Map((values ?? []).map((v) => [v.fieldId, v.value])), [values]);
  const attachmentsById = useMemo(() => new Map((attachments ?? []).map((a) => [a.id, a])), [attachments]);

  // Single stable callback shared by every field row (keyed by the fieldId
  // each caller passes in) instead of a fresh `(value) => setValue.mutate(…)`
  // arrow per field per render — required for FieldInput's memo above to
  // actually skip unrelated rows instead of re-rendering all of them anyway.
  // Depending on the full `setValue` object (a new one every render, per
  // useMutation) would defeat that entirely — `.mutate` itself is what's
  // actually stable across renders.
  const handleCommitValue = useCallback(
    (fieldId: string, value: string) => setValue.mutate({ fieldId, value }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setValue.mutate],
  );

  // A dependent field's stored value can go stale the moment its parent's
  // value changes — either a conditionValue mismatch just hid it, or a
  // hierarchical select's optionsByParent no longer includes what's
  // currently stored (e.g. Category flips from "Software" to "Hardware"
  // while Subcategory is still "Laptop issue"). Without this, the two drift
  // apart silently: a hidden field keeps its old value forever (invisible
  // here, but still read by CSV export/automation rules), and a narrowed
  // <select> can't even render its own stale value as selected — no
  // matching <option>, so it just LOOKS cleared while the real stored value
  // is untouched. Re-runs (and self-limits: cleared fields have no value
  // left to re-clear) whenever sibling values change, since clearing one
  // field can itself invalidate another in a chain.
  useEffect(() => {
    if (!definitions || !values) return;
    for (const field of definitions) {
      if (!field.dependsOnFieldId) continue;
      const currentValue = valueByField.get(field.id);
      if (!currentValue) continue;
      const parentValue = valueByField.get(field.dependsOnFieldId);

      const hiddenByCondition = !!field.conditionValue && parentValue !== field.conditionValue;
      const invalidHierarchicalOption =
        field.fieldType === CustomFieldType.SELECT &&
        !!field.optionsByParent &&
        !(parentValue && (field.optionsByParent[parentValue] ?? []).includes(currentValue));

      if (hiddenByCondition || invalidHierarchicalOption) {
        setValue.mutate({ fieldId: field.id, value: '' });
      }
    }
    // valueByField is a fresh object every render (derived from `values`),
    // so depending on it directly would loop — `values` itself is the real
    // trigger, same object identity per fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definitions, values, setValue.mutate]);

  if (!definitions || definitions.length === 0) return null;

  // Which parent SELECT options a hierarchical child's dropdown should
  // currently offer — computed once per render since it only depends on
  // sibling values already fetched above, not on anything per-field-async.
  function optionsFor(field: PublicCustomFieldDefinition): PublicCustomFieldDefinition {
    if (!field.dependsOnFieldId || !field.optionsByParent) return field;
    const parentValue = valueByField.get(field.dependsOnFieldId);
    return { ...field, options: parentValue ? (field.optionsByParent[parentValue] ?? []) : [] };
  }

  // A field with a visibility condition is hidden until its dependency's
  // current value matches — checked before rendering, not just disabled, so
  // an admin's "show only when X" reads as an actual reveal, not a greyed-
  // out row nobody notices.
  const visibleDefinitions = definitions.filter((field) => {
    if (!field.dependsOnFieldId || !field.conditionValue) return true;
    return valueByField.get(field.dependsOnFieldId) === field.conditionValue;
  });

  if (visibleDefinitions.length === 0) return null;

  return (
    <div className="border-b border-border p-4">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('customFields.title')}</div>
      <div className="flex flex-col gap-3">
        {visibleDefinitions.map((field) => (
          <div key={field.id}>
            <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink-muted">
              {field.fieldType === CustomFieldType.CHECKBOX && (
                <FieldInput
                  field={field}
                  value={valueByField.get(field.id) ?? ''}
                  ticketId={ticketId}
                  attachmentsById={attachmentsById}
                  onCommit={handleCommitValue}
                />
              )}
              {pickLocalized(field.label, field.labelUk, field.labelEn, i18n.language)}
            </label>
            {field.fieldType !== CustomFieldType.CHECKBOX && (
              <FieldInput
                field={optionsFor(field)}
                value={valueByField.get(field.id) ?? ''}
                ticketId={ticketId}
                attachmentsById={attachmentsById}
                onCommit={handleCommitValue}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
