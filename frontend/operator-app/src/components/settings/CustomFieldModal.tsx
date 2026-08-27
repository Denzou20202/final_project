import { CustomFieldType } from '@veloxdesk/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAutoTranslate } from '../../hooks/useAutoTranslate.js';
import { useCreateCustomFieldDefinition, useCustomFieldDefinitions, useUpdateCustomFieldDefinition } from '../../hooks/useCustomFields.js';
import { getErrorMessage } from '../../lib/errors.js';
import { pickLocalized } from '../../lib/localized.js';
import type { PublicCustomFieldDefinition } from '../../lib/types.js';

// Ready-made regex templates — a convenience for filling the pattern input,
// not a stored concept of its own (the backend only ever sees the plain
// regex string once picked).
const PATTERN_PRESETS: { key: string; pattern: string }[] = [
  { key: 'phone', pattern: '^\\+?[0-9\\s\\-()]{7,20}$' },
  { key: 'email', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
  { key: 'card', pattern: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$' },
];

type FormValues = {
  label: string;
  labelUk: string;
  labelEn: string;
  fieldType: CustomFieldType;
  optionsText: string;
  pattern: string;
  dependsOnFieldId: string;
  conditionValue: string;
  // One entry per parent option, newline-separated child options — parsed
  // into Record<string, string[]> (optionsByParent) on submit. Keyed by the
  // dependency field's own option list, so it always has the right shape
  // even if the dependency changes mid-edit.
  nestedOptionsByParent: Record<string, string>;
};

function parseOptions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function CustomFieldModal({
  existing,
  onClose,
}: {
  existing: PublicCustomFieldDefinition | undefined;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: allFields } = useCustomFieldDefinitions();
  const dependencyOptions = (allFields ?? []).filter((f) => f.id !== existing?.id);

  // Rebuilt on language change so validation messages follow the active
  // locale — a module-level schema would freeze at whatever language was
  // active on first import.
  const schema = useMemo(
    () =>
      z
        .object({
          label: z.string().min(1, t('admin.customFields.nameRequired')),
          labelUk: z.string(),
          labelEn: z.string(),
          fieldType: z.nativeEnum(CustomFieldType),
          optionsText: z.string(),
          pattern: z.string(),
          dependsOnFieldId: z.string(),
          conditionValue: z.string(),
          nestedOptionsByParent: z.record(z.string(), z.string()),
        })
        .refine(
          (values) =>
            values.fieldType !== CustomFieldType.SELECT ||
            values.dependsOnFieldId ||
            values.optionsText.trim().length > 0,
          { message: t('admin.customFields.optionsRequired'), path: ['optionsText'] },
        )
        .refine((values) => values.fieldType !== CustomFieldType.REGEX || values.pattern.trim().length > 0, {
          message: t('admin.customFields.patternRequired'),
          path: ['pattern'],
        }),
    [t],
  );
  const createField = useCreateCustomFieldDefinition();
  const updateField = useUpdateCustomFieldDefinition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          label: existing.label,
          labelUk: existing.labelUk ?? '',
          labelEn: existing.labelEn ?? '',
          fieldType: existing.fieldType,
          optionsText: (existing.options ?? []).join('\n'),
          pattern: existing.pattern ?? '',
          dependsOnFieldId: existing.dependsOnFieldId ?? '',
          conditionValue: existing.conditionValue ?? '',
          nestedOptionsByParent: Object.fromEntries(
            Object.entries(existing.optionsByParent ?? {}).map(([k, v]) => [k, v.join('\n')]),
          ),
        }
      : {
          labelUk: '',
          labelEn: '',
          fieldType: CustomFieldType.TEXT,
          optionsText: '',
          pattern: '',
          dependsOnFieldId: '',
          conditionValue: '',
          nestedOptionsByParent: {},
        },
  });
  const [ukEnTouched, setUkEnTouched] = useState(!!existing);
  const label = watch('label');
  useAutoTranslate(
    label,
    !ukEnTouched,
    useCallback(
      (uk, en) => {
        if (uk) setValue('labelUk', uk);
        if (en) setValue('labelEn', en);
      },
      [setValue],
    ),
  );
  const fieldType = watch('fieldType');
  const dependsOnFieldId = watch('dependsOnFieldId');
  const dependencyField = dependencyOptions.find((f) => f.id === dependsOnFieldId);
  // Hierarchical (parent → child) options only make sense when this field
  // AND its dependency are both SELECT — a text field "depending" on a
  // select only ever uses conditionValue (plain visibility gating).
  const isHierarchical = fieldType === CustomFieldType.SELECT && dependencyField?.fieldType === CustomFieldType.SELECT;

  const onSubmit = (values: FormValues) => {
    const options =
      values.fieldType === CustomFieldType.SELECT && !isHierarchical ? parseOptions(values.optionsText) : undefined;
    const optionsByParent = isHierarchical
      ? Object.fromEntries(
          (dependencyField?.options ?? []).map((parentOption) => [
            parentOption,
            parseOptions(values.nestedOptionsByParent[parentOption] ?? ''),
          ]),
        )
      : undefined;
    const pattern = values.fieldType === CustomFieldType.REGEX ? values.pattern.trim() : undefined;
    const dependsOnFieldIdValue = values.dependsOnFieldId || undefined;
    const conditionValue = values.dependsOnFieldId && values.conditionValue ? values.conditionValue : undefined;

    if (existing) {
      updateField.mutate(
        {
          id: existing.id,
          label: values.label,
          labelUk: values.labelUk.trim(),
          labelEn: values.labelEn.trim(),
          options,
          pattern,
          dependsOnFieldId: dependsOnFieldIdValue,
          conditionValue,
          optionsByParent,
        },
        { onSuccess: onClose },
      );
    } else {
      createField.mutate(
        {
          label: values.label,
          labelUk: values.labelUk.trim(),
          labelEn: values.labelEn.trim(),
          fieldType: values.fieldType,
          options,
          pattern,
          dependsOnFieldId: dependsOnFieldIdValue,
          conditionValue,
          optionsByParent,
        },
        { onSuccess: onClose },
      );
    }
  };

  const mutation = existing ? updateField : createField;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.customFields.editTitle') : t('admin.customFields.newTitle')}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="label" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.customFields.nameLabel')}
            </label>
            <input
              id="label"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('label')}
            />
            {errors.label && <p className="mt-1 text-xs text-priority-urgent">{errors.label.message}</p>}
          </div>

          <div>
            <label htmlFor="labelUk" className="mb-1 block text-sm font-medium text-ink-muted">
              UK
            </label>
            <input
              id="labelUk"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('labelUk', { onChange: () => setUkEnTouched(true) })}
            />
          </div>

          <div>
            <label htmlFor="labelEn" className="mb-1 block text-sm font-medium text-ink-muted">
              EN
            </label>
            <input
              id="labelEn"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('labelEn', { onChange: () => setUkEnTouched(true) })}
            />
            <p className="mt-1 text-[11px] text-ink-faint">{t('settings.autoTranslateHint')}</p>
          </div>

          <div>
            <label htmlFor="fieldType" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.customFields.typeLabel')}
            </label>
            <select
              id="fieldType"
              disabled={!!existing}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600 disabled:bg-surface-muted disabled:text-ink-faint"
              {...register('fieldType')}
            >
              {Object.values(CustomFieldType).map((type) => (
                <option key={type} value={type}>
                  {t(`customFieldType.${type}`)}
                </option>
              ))}
            </select>
            {existing && <p className="mt-1 text-xs text-ink-faint">{t('admin.customFields.typeImmutableHint')}</p>}
          </div>

          {fieldType === CustomFieldType.SELECT && !isHierarchical && (
            <div>
              <label htmlFor="optionsText" className="mb-1 block text-sm font-medium text-ink-muted">
                {t('admin.customFields.optionsLabel')}
              </label>
              <textarea
                id="optionsText"
                rows={4}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
                {...register('optionsText')}
              />
              {errors.optionsText && <p className="mt-1 text-xs text-priority-urgent">{errors.optionsText.message}</p>}
            </div>
          )}

          {fieldType === CustomFieldType.REGEX && (
            <div>
              <label htmlFor="pattern" className="mb-1 block text-sm font-medium text-ink-muted">
                {t('admin.customFields.patternLabel')}
              </label>
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {PATTERN_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setValue('pattern', preset.pattern, { shouldValidate: true })}
                    className="rounded-full border border-border px-2.5 py-1 text-[12px] font-medium text-ink-muted hover:border-brand-600 hover:text-brand-600"
                  >
                    {t(`admin.customFields.preset.${preset.key}`)}
                  </button>
                ))}
              </div>
              <input
                id="pattern"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
                placeholder="^\d{10}$"
                {...register('pattern')}
              />
              {errors.pattern && <p className="mt-1 text-xs text-priority-urgent">{errors.pattern.message}</p>}
            </div>
          )}

          <div className="rounded-lg border border-border-subtle p-3">
            <label htmlFor="dependsOnFieldId" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.customFields.dependsOnLabel')}
            </label>
            <select
              id="dependsOnFieldId"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('dependsOnFieldId')}
            >
              <option value="">{t('admin.customFields.dependsOnNone')}</option>
              {dependencyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {pickLocalized(f.label, f.labelUk, f.labelEn, i18n.language)}
                </option>
              ))}
            </select>

            {dependsOnFieldId && !isHierarchical && (
              <div className="mt-2">
                <label htmlFor="conditionValue" className="mb-1 block text-sm font-medium text-ink-muted">
                  {t('admin.customFields.conditionValueLabel', { name: dependencyField?.label ?? '' })}
                </label>
                <input
                  id="conditionValue"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
                  placeholder={t('admin.customFields.conditionValuePlaceholder')}
                  {...register('conditionValue')}
                />
                <p className="mt-1 text-xs text-ink-faint">{t('admin.customFields.conditionValueHint')}</p>
              </div>
            )}

            {isHierarchical && (
              <div className="mt-2">
                <div className="mb-1 text-sm font-medium text-ink-muted">{t('admin.customFields.nestedOptionsLabel')}</div>
                <p className="mb-2 text-xs text-ink-faint">{t('admin.customFields.nestedOptionsHint')}</p>
                <div className="flex flex-col gap-2">
                  {(dependencyField?.options ?? []).map((parentOption) => (
                    <div key={parentOption}>
                      <label className="mb-1 block text-[12.5px] font-medium text-ink-subtle">{parentOption}</label>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
                        {...register(`nestedOptionsByParent.${parentOption}`)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
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
