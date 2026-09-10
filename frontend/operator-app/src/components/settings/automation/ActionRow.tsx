import { AutomationActionType, CustomFieldType, TicketPriority } from '@veloxdesk/types';
import { useState } from 'react';
import type { Control, FieldError, FieldErrorsImpl, Merge, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { pickLocalized } from '../../../lib/localized.js';
import type { PublicCustomFieldDefinition, PublicMacro, PublicTeam, PublicTicketStatus, PublicUser } from '../../../lib/types.js';
import type { ActionFormValue, RuleFormValues } from './rule-form-values.js';

const inputClass = 'rounded-lg border border-border bg-surface-card px-2 py-1.5 text-[12.5px] outline-none focus:border-brand-600';

export function ActionRow({
  index,
  control,
  register,
  setValue,
  onRemove,
  customFields,
  teams,
  statuses,
  operators,
  macros,
  initialFormula,
  error,
}: {
  index: number;
  control: Control<RuleFormValues>;
  register: UseFormRegister<RuleFormValues>;
  setValue: UseFormSetValue<RuleFormValues>;
  onRemove: () => void;
  customFields: PublicCustomFieldDefinition[];
  teams: PublicTeam[];
  statuses: PublicTicketStatus[];
  operators: PublicUser[];
  macros: PublicMacro[];
  // Mount-time-only seed for the value/formula toggle — whichever the row
  // already had when the modal opened for editing; new rows default to
  // "value" (see call site in AutomationRuleModal).
  initialFormula: string | undefined;
  // The action schema's cross-field `.refine()` (exactly one of value/formula
  // for SET_CUSTOM_FIELD, else value required) has no `path`, so zodResolver
  // attaches it to the action object itself rather than one specific field —
  // rendered as a single row-level message below, not per-input.
  error?: Merge<FieldError, FieldErrorsImpl<ActionFormValue>>;
}) {
  const { t, i18n } = useTranslation();
  const type = useWatch({ control, name: `actions.${index}.type` });
  const fieldId = useWatch({ control, name: `actions.${index}.fieldId` });
  // Also drives the explicit `value=` pin on every select below that's
  // register()'d to `actions.${index}.value` — see the comment on the
  // SET_CUSTOM_FIELD fieldId select for why a bare register() isn't enough
  // on its own here.
  const value = useWatch({ control, name: `actions.${index}.value` });
  const selectedCustomField = customFields.find((f) => f.id === fieldId);
  const [customFieldMode, setCustomFieldMode] = useState<'value' | 'formula'>(initialFormula ? 'formula' : 'value');

  function handleTypeChange(next: AutomationActionType) {
    setValue(`actions.${index}.type`, next);
    setValue(`actions.${index}.value`, '');
    setValue(`actions.${index}.fieldId`, undefined);
    setValue(`actions.${index}.formula`, undefined);
  }

  function switchCustomFieldMode(mode: 'value' | 'formula') {
    setCustomFieldMode(mode);
    if (mode === 'value') {
      setValue(`actions.${index}.formula`, undefined);
    } else {
      setValue(`actions.${index}.value`, undefined);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface-muted/40 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={type} onChange={(e) => handleTypeChange(e.target.value as AutomationActionType)} className={inputClass}>
          {Object.values(AutomationActionType).map((actionType) => (
            <option key={actionType} value={actionType}>
              {t(`automationActionType.${actionType}`)}
            </option>
          ))}
        </select>

        {type === AutomationActionType.SET_STATUS && (
          <select {...register(`actions.${index}.value`)} value={value ?? ''} className={inputClass}>
            <option value="">{t('admin.automation.selectStatus')}</option>
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.key ? t(`ticketStatus.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}
              </option>
            ))}
          </select>
        )}

        {type === AutomationActionType.SET_PRIORITY && (
          <select {...register(`actions.${index}.value`)} value={value ?? ''} className={inputClass}>
            <option value="">{t('admin.automation.selectPriority')}</option>
            {Object.values(TicketPriority).map((priority) => (
              <option key={priority} value={priority}>
                {t(`ticketPriority.${priority}`)}
              </option>
            ))}
          </select>
        )}

        {type === AutomationActionType.ASSIGN_TEAM && (
          <select {...register(`actions.${index}.value`)} value={value ?? ''} className={inputClass}>
            <option value="">{t('admin.automation.selectTeam')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
              </option>
            ))}
          </select>
        )}

        {type === AutomationActionType.ASSIGN_USER && (
          <select {...register(`actions.${index}.value`)} value={value ?? ''} className={inputClass}>
            <option value="">{t('admin.automation.selectAssignee')}</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.fullName}
              </option>
            ))}
          </select>
        )}

        {type === AutomationActionType.SET_CUSTOM_FIELD && (
          // Explicitly controlled via the watched `fieldId`, on top of
          // register(). A plain register()'d <select> only sets its DOM
          // value imperatively once; when customFields finishes loading a
          // moment after this row mounts (an existing rule opened before
          // Sidebar's warm-up query has resolved), React swaps in the real
          // <option> for this id and a native <select> doesn't carry
          // "selected" across that swap — nothing re-applies it afterward,
          // so it silently reverts to blank. Pinning `value` re-asserts the
          // correct value on every render, including the one right after
          // that swap. Same fix as EditUserModal's company/city selects.
          <select {...register(`actions.${index}.fieldId`)} value={fieldId ?? ''} className={inputClass}>
            <option value="">{t('admin.automation.selectField')}</option>
            {customFields.map((cf) => (
              <option key={cf.id} value={cf.id}>
                {pickLocalized(cf.label, cf.labelUk, cf.labelEn, i18n.language)}
              </option>
            ))}
          </select>
        )}

        {type === AutomationActionType.APPLY_MACRO && (
          // See the analogous comment on the SET_CUSTOM_FIELD fieldId select
          // above — same race, this time against `macros` loading.
          <select
            {...register(`actions.${index}.value`)}
            value={value ?? ''}
            title={t('admin.automation.applyMacroHint')}
            className={inputClass}
          >
            <option value="">{t('admin.automation.selectMacro')}</option>
            {macros.map((macro) => (
              <option key={macro.id} value={macro.id}>
                {pickLocalized(macro.title, macro.titleUk, macro.titleEn, i18n.language)}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-[12px] font-medium text-priority-urgent hover:underline"
        >
          {t('admin.automation.delete')}
        </button>
      </div>

      {type === AutomationActionType.SET_CUSTOM_FIELD && fieldId && (
        <div className="flex flex-col gap-1.5 pl-1">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => switchCustomFieldMode('value')}
              className={`rounded px-2 py-0.5 text-[11.5px] font-medium ${
                customFieldMode === 'value' ? 'bg-brand-100 text-brand-700' : 'text-ink-faint hover:bg-surface-muted'
              }`}
            >
              {t('admin.automation.valueLabel')}
            </button>
            <button
              type="button"
              onClick={() => switchCustomFieldMode('formula')}
              disabled={selectedCustomField?.fieldType !== CustomFieldType.NUMBER}
              title={
                selectedCustomField?.fieldType !== CustomFieldType.NUMBER
                  ? t('admin.automation.formulaOnlyForNumber')
                  : undefined
              }
              className={`rounded px-2 py-0.5 text-[11.5px] font-medium disabled:opacity-40 ${
                customFieldMode === 'formula' ? 'bg-brand-100 text-brand-700' : 'text-ink-faint hover:bg-surface-muted'
              }`}
            >
              {t('admin.automation.formulaLabel')}
            </button>
          </div>

          {customFieldMode === 'value' &&
            (selectedCustomField?.fieldType === CustomFieldType.SELECT ? (
              // Same pin as the other selects bound to this field — this one's
              // <option>s come from the custom field definition's own
              // `options` array, live off the same `customFields` fetch.
              <select {...register(`actions.${index}.value`)} value={value ?? ''} className={inputClass}>
                <option value="">{t('admin.automation.selectValue')}</option>
                {(selectedCustomField.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input {...register(`actions.${index}.value`)} placeholder={t('admin.automation.valueLabel')} className={inputClass} />
            ))}

          {customFieldMode === 'formula' && (
            <input
              {...register(`actions.${index}.formula`)}
              placeholder={t('admin.automation.formulaPlaceholder')}
              className={`${inputClass} font-mono`}
            />
          )}
        </div>
      )}
      {error?.message && <p className="text-xs text-priority-urgent">{error.message}</p>}
    </div>
  );
}
