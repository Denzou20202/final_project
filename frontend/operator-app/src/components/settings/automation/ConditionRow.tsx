import { AutomationConditionField, AutomationConditionOperator, CustomFieldType, TicketPriority } from '@veloxdesk/types';
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { pickLocalized } from '../../../lib/localized.js';
import type { PublicCustomFieldDefinition, PublicTeam, PublicTicketStatus } from '../../../lib/types.js';
import type { ConditionFormValue, RuleFormValues } from './rule-form-values.js';

const inputClass = 'rounded-lg border border-border bg-surface-card px-2 py-1.5 text-[12.5px] outline-none focus:border-brand-600';

export function ConditionRow({
  index,
  control,
  register,
  setValue,
  onRemove,
  customFields,
  teams,
  statuses,
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
  error?: FieldErrors<ConditionFormValue>;
}) {
  const { t, i18n } = useTranslation();
  const field = useWatch({ control, name: `conditions.${index}.field` });
  const fieldId = useWatch({ control, name: `conditions.${index}.fieldId` });
  // Also drives the explicit `value=` pin on every select below that's
  // register()'d to `conditions.${index}.value` — see the comment on the
  // CUSTOM_FIELD fieldId select for why a bare register() isn't enough here.
  const value = useWatch({ control, name: `conditions.${index}.value` });
  const selectedCustomField = customFields.find((f) => f.id === fieldId);

  function handleFieldChange(next: AutomationConditionField) {
    setValue(`conditions.${index}.field`, next);
    setValue(`conditions.${index}.fieldId`, undefined);
    setValue(`conditions.${index}.value`, '');
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-muted/40 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={field}
          onChange={(e) => handleFieldChange(e.target.value as AutomationConditionField)}
          className={inputClass}
        >
          {Object.values(AutomationConditionField).map((f) => (
            <option key={f} value={f}>
              {t(`automationConditionField.${f}`)}
            </option>
          ))}
        </select>

        {field === AutomationConditionField.CUSTOM_FIELD && (
          // Explicitly controlled via the watched `fieldId`, on top of
          // register() — same fix as ActionRow's SET_CUSTOM_FIELD fieldId
          // select (see its comment): a plain register()'d <select> doesn't
          // re-sync once customFields finishes loading and swaps the real
          // <option> in for this id, so pinning `value` here re-asserts it on
          // every render.
          <select {...register(`conditions.${index}.fieldId`)} value={fieldId ?? ''} className={inputClass}>
            <option value="">{t('admin.automation.selectField')}</option>
            {customFields.map((cf) => (
              <option key={cf.id} value={cf.id}>
                {pickLocalized(cf.label, cf.labelUk, cf.labelEn, i18n.language)}
              </option>
            ))}
          </select>
        )}

        {/* Static enum options, never async-loaded — no swap race, so no
            explicit `value` pin needed here (unlike the selects below). */}
        <select {...register(`conditions.${index}.operator`)} className={inputClass}>
          {Object.values(AutomationConditionOperator).map((op) => (
            <option key={op} value={op}>
              {t(`automationConditionOperator.${op}`)}
            </option>
          ))}
        </select>

        {field === AutomationConditionField.STATUS && (
          <select {...register(`conditions.${index}.value`)} value={value ?? ''} className={inputClass}>
            {/* 'unassigned' isn't a real status id — it's the same cosmetic
                "Неприсвоенная" state StatusBadge.tsx shows instead of the
                default status's own label, for a default-status unassigned
                ticket. The backend resolves it the same way before comparing
                (see condition-evaluator.ts). */}
            <option value="unassigned">{t('ticketStatus.unassigned')}</option>
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.key ? t(`ticketStatus.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}
              </option>
            ))}
          </select>
        )}

        {field === AutomationConditionField.PRIORITY && (
          <select {...register(`conditions.${index}.value`)} value={value ?? ''} className={inputClass}>
            {Object.values(TicketPriority).map((priority) => (
              <option key={priority} value={priority}>
                {t(`ticketPriority.${priority}`)}
              </option>
            ))}
          </select>
        )}

        {field === AutomationConditionField.TEAM_ID && (
          <select {...register(`conditions.${index}.value`)} value={value ?? ''} className={inputClass}>
            <option value="">{t('admin.automation.selectTeam')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
              </option>
            ))}
          </select>
        )}

        {field === AutomationConditionField.CUSTOM_FIELD &&
          (selectedCustomField?.fieldType === CustomFieldType.SELECT ? (
            <select {...register(`conditions.${index}.value`)} value={value ?? ''} className={inputClass}>
              <option value="">{t('admin.automation.selectValue')}</option>
              {(selectedCustomField.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input {...register(`conditions.${index}.value`)} placeholder={t('admin.automation.valueLabel')} className={inputClass} />
          ))}

        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-[12px] font-medium text-priority-urgent hover:underline"
        >
          {t('admin.automation.delete')}
        </button>
      </div>
      {error?.value && <p className="text-xs text-priority-urgent">{error.value.message}</p>}
    </div>
  );
}
