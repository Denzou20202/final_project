import { AutomationCondition, AutomationConditionField, AutomationConditionOperator } from '@veloxdesk/types';

export interface ConditionContext {
  // 'unassigned' replaces the real 'open' value when the ticket has no
  // assignee — mirrors StatusBadge.tsx's cosmetic "Неприсвоенная" label, so
  // a "Статус = Неприсвоенная" condition matches exactly what an operator
  // sees, and "Статус = В работе" only matches an ASSIGNED open ticket
  // (consistent with the sidebar's own Неприсвоенные/В работе split).
  status: string;
  priority: string;
  teamId: string | null;
  // fieldId -> current string value on this ticket; a field with no value
  // set on the ticket simply has no entry here (see custom-fields.service —
  // ticket_custom_field_values only ever holds rows for values actually set).
  customFieldValues: Map<string, string>;
}

// AND-only for v1 — every condition in the array must match for the rule's
// actions to run. No OR/nesting; keeps both the evaluator and the admin UI
// builder simple, and covers the overwhelming majority of real dispatcher
// rules ("priority = urgent AND team = X").
export function evaluateConditions(conditions: AutomationCondition[], context: ConditionContext): boolean {
  return conditions.every((condition) => evaluateCondition(condition, context));
}

function evaluateCondition(condition: AutomationCondition, context: ConditionContext): boolean {
  const actual = resolveFieldValue(condition, context);

  // A field with no value is never "equal" to anything, but it IS trivially
  // "not equal" to any specific value — e.g. "custom field X != 'urgent'"
  // should match a ticket where X was never set.
  if (actual === undefined) {
    return condition.operator === AutomationConditionOperator.NOT_EQUALS;
  }

  switch (condition.operator) {
    case AutomationConditionOperator.EQUALS:
      return actual === condition.value;
    case AutomationConditionOperator.NOT_EQUALS:
      return actual !== condition.value;
  }
}

function resolveFieldValue(condition: AutomationCondition, context: ConditionContext): string | undefined {
  switch (condition.field) {
    case AutomationConditionField.STATUS:
      return context.status;
    case AutomationConditionField.PRIORITY:
      return context.priority;
    case AutomationConditionField.TEAM_ID:
      return context.teamId ?? undefined;
    case AutomationConditionField.CUSTOM_FIELD:
      return condition.fieldId ? context.customFieldValues.get(condition.fieldId) : undefined;
  }
}
