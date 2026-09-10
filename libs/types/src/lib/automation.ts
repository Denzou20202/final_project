import { AutomationActionType, AutomationConditionField, AutomationConditionOperator } from './enums.js';

// Stored as a jsonb array on AutomationRuleEntity — all conditions in the
// array must match (AND-only for v1, no OR/nesting) for the rule's actions
// to run. `fieldId` is only meaningful when field === CUSTOM_FIELD.
//
// field === STATUS accepts one extra sentinel value alongside the 4 real
// TicketStatus values: 'unassigned' matches an open ticket with no assignee
// — the same cosmetic "Неприсвоенная" state StatusBadge.tsx shows instead
// of "В работе" (see condition-evaluator.ts's ConditionContext.status,
// which resolves this the same way before comparing).
export interface AutomationCondition {
  field: AutomationConditionField;
  fieldId?: string;
  operator: AutomationConditionOperator;
  value: string;
}

// Stored as a jsonb array on AutomationRuleEntity, applied in order. Exactly
// one of `value`/`formula` is meaningful per action type:
// - SET_STATUS / SET_PRIORITY / ASSIGN_TEAM / ASSIGN_USER: `value` holds the
//   target enum value or target entity id.
// - SET_CUSTOM_FIELD: `fieldId` is the target field, and the field is set
//   either to a literal `value` or to the result of evaluating `formula`
//   (a $calc()-style arithmetic expression referencing other custom number
//   fields via `{field:<fieldId>}` tokens) when `formula` is present.
// - APPLY_MACRO: `value` holds the target macro's id — posted as a real
//   public reply from the ticket's current assignee (skipped if the ticket
//   is still unassigned when the rule fires, since a comment needs a real
//   author). Placeholders in the macro body are substituted the same way
//   ChatPanel.tsx's manual "Вставить макрос" does.
export interface AutomationAction {
  type: AutomationActionType;
  value?: string;
  fieldId?: string;
  formula?: string;
}
