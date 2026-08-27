import {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationConditionField,
  AutomationConditionOperator,
  AutomationTrigger,
} from '@veloxdesk/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCreateAutomationRule, useUpdateAutomationRule } from '../../hooks/useAutomationRules.js';
import { useCustomFieldDefinitions } from '../../hooks/useCustomFields.js';
import { useMacros } from '../../hooks/useMacros.js';
import { useTeams } from '../../hooks/useTeams.js';
import { useTicketStatuses } from '../../hooks/useTicketStatuses.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { getErrorMessage } from '../../lib/errors.js';
import { isAssignableStaff } from '../../lib/staff.js';
import type { PublicAutomationRule } from '../../lib/types.js';
import { ActionRow } from './automation/ActionRow.js';
import { ConditionRow } from './automation/ConditionRow.js';
import type { ActionFormValue, ConditionFormValue, RuleFormValues } from './automation/rule-form-values.js';

function cleanCondition(c: ConditionFormValue): AutomationCondition {
  return {
    field: c.field,
    fieldId: c.field === AutomationConditionField.CUSTOM_FIELD ? c.fieldId : undefined,
    operator: c.operator,
    value: c.value,
  };
}

function cleanAction(a: ActionFormValue): AutomationAction {
  if (a.type === AutomationActionType.SET_CUSTOM_FIELD) {
    return {
      type: a.type,
      fieldId: a.fieldId,
      value: a.formula?.trim() ? undefined : a.value,
      formula: a.formula?.trim() ? a.formula : undefined,
    };
  }
  return { type: a.type, value: a.value };
}

export function AutomationRuleModal({
  existing,
  onClose,
}: {
  existing: PublicAutomationRule | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Rebuilt on language change so validation messages follow the active
  // locale — a module-level schema would freeze at whatever language was
  // active on first import.
  const schema = useMemo(() => {
    const conditionSchema = z.object({
      field: z.nativeEnum(AutomationConditionField),
      fieldId: z.string().optional(),
      operator: z.nativeEnum(AutomationConditionOperator),
      value: z.string().min(1, t('admin.automation.valueRequired')),
    });
    const actionSchema = z
      .object({
        type: z.nativeEnum(AutomationActionType),
        value: z.string().optional(),
        fieldId: z.string().optional(),
        formula: z.string().optional(),
      })
      .refine(
        (action) => {
          if (action.type === AutomationActionType.SET_CUSTOM_FIELD) {
            const hasValue = !!action.value?.trim();
            const hasFormula = !!action.formula?.trim();
            return !!action.fieldId && hasValue !== hasFormula;
          }
          return !!action.value?.trim();
        },
        { message: t('admin.automation.actionFieldsRequired') },
      );
    return z.object({
      name: z.string().min(2, t('admin.automation.nameMinLength')),
      trigger: z.nativeEnum(AutomationTrigger),
      conditions: z.array(conditionSchema),
      actions: z.array(actionSchema).min(1, t('admin.automation.atLeastOneAction')),
    });
  }, [t]);
  const createRule = useCreateAutomationRule();
  const updateRule = useUpdateAutomationRule();
  const { data: customFields } = useCustomFieldDefinitions();
  const { data: teams } = useTeams();
  const { data: statuses } = useTicketStatuses();
  const { data: macros } = useMacros();
  const { data: usersPage } = useAssignableUsers();
  // Deactivated staff excluded too (not just clients/наблюдатели) — a rule
  // pointing at a deactivated operator would silently no-op at runtime
  // (applyAutomatedAssignee's find() won't see soft-deleted rows).
  const operators = (usersPage?.items ?? []).filter(isAssignableStaff);

  // `values` (not `defaultValues`) — the SET_CUSTOM_FIELD fieldId / APPLY_MACRO
  // value selects in ActionRow/ConditionRow are register()-only <select>s
  // whose <option>s come from customFields/macros, which (unlike teams/
  // statuses/assignableUsers) are only fetched here and in Sidebar's warm-up
  // (see that file). With plain defaultValues, a row that mounts referencing
  // a field/macro before either list has loaded renders unselected and RHF
  // never re-syncs it once the real option shows up a moment later — an
  // admin who saves quickly can silently blank out that action/condition,
  // which then fails the array-level zod `.refine()` below with an error
  // that's easy to miss for a per-item validation failure. `values` re-
  // applies whenever this object changes (i.e. once the lists load), fixing
  // that; keepDirtyValues stops it from clobbering rows the admin already
  // edited if these lists happen to refetch mid-edit. Exact same fix as
  // EditUserModal's `values` switch for the identical bug class.
  const formValues = useMemo<RuleFormValues>(
    () =>
      existing
        ? { name: existing.name, trigger: existing.trigger, conditions: existing.conditions, actions: existing.actions }
        : {
            name: '',
            trigger: AutomationTrigger.TICKET_CREATED,
            conditions: [],
            actions: [{ type: AutomationActionType.SET_STATUS, value: '' }],
          },
    // customFields/macros aren't read in the body — they're deps purely to
    // force a new object reference (and thus RHF's `values` re-sync) once
    // those lists finish loading. See the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existing, customFields, macros],
  );

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(schema),
    values: formValues,
    resetOptions: { keepDirtyValues: true },
  });

  const conditionsArray = useFieldArray({ control, name: 'conditions' });
  const actionsArray = useFieldArray({ control, name: 'actions' });

  const onSubmit = (values: RuleFormValues) => {
    const payload = {
      name: values.name,
      trigger: values.trigger,
      conditions: values.conditions.map(cleanCondition),
      actions: values.actions.map(cleanAction),
    };
    if (existing) {
      updateRule.mutate({ id: existing.id, ...payload }, { onSuccess: onClose });
    } else {
      createRule.mutate(payload, { onSuccess: onClose });
    }
  };

  const mutation = existing ? updateRule : createRule;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.automation.editTitle') : t('admin.automation.newTitle')}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1" noValidate>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.automation.nameLabel')}
            </label>
            <input
              id="name"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('name')}
            />
            {errors.name && <p className="mt-1 text-xs text-priority-urgent">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="trigger" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.automation.triggerLabel')}
            </label>
            <select
              id="trigger"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('trigger')}
            >
              {Object.values(AutomationTrigger).map((trigger) => (
                <option key={trigger} value={trigger}>
                  {t(`automationTrigger.${trigger}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-muted">
                {t('admin.automation.conditionsLabel')}{' '}
                <span className="text-ink-faint">{t('admin.automation.conditionsEmptyHint')}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  conditionsArray.append({
                    field: AutomationConditionField.STATUS,
                    operator: AutomationConditionOperator.EQUALS,
                    value: '',
                  })
                }
                className="text-[12.5px] font-medium text-brand-600 hover:underline"
              >
                {t('admin.automation.addCondition')}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {conditionsArray.fields.map((item, index) => (
                <ConditionRow
                  key={item.id}
                  index={index}
                  control={control}
                  register={register}
                  setValue={setValue}
                  onRemove={() => conditionsArray.remove(index)}
                  customFields={customFields ?? []}
                  teams={teams ?? []}
                  statuses={statuses ?? []}
                />
              ))}
              {conditionsArray.fields.length === 0 && (
                <div className="rounded-lg border border-dashed border-border-subtle p-3 text-center text-[12.5px] text-ink-faint">
                  {t('admin.automation.noConditionsHint')}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-muted">{t('admin.automation.actionsLabel')}</span>
              <button
                type="button"
                onClick={() => actionsArray.append({ type: AutomationActionType.SET_STATUS, value: '' })}
                className="text-[12.5px] font-medium text-brand-600 hover:underline"
              >
                {t('admin.automation.addAction')}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {actionsArray.fields.map((item, index) => (
                <ActionRow
                  key={item.id}
                  index={index}
                  control={control}
                  register={register}
                  setValue={setValue}
                  onRemove={() => actionsArray.remove(index)}
                  customFields={customFields ?? []}
                  teams={teams ?? []}
                  statuses={statuses ?? []}
                  operators={operators}
                  macros={macros ?? []}
                  initialFormula={item.formula}
                />
              ))}
            </div>
            {errors.actions && typeof errors.actions.message === 'string' && (
              <p className="mt-1.5 text-xs text-priority-urgent">{errors.actions.message}</p>
            )}
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{errorMessage}</p>
          )}

          <div className="mt-1 flex justify-end gap-2 border-t border-border-subtle pt-3">
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
