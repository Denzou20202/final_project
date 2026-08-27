import type {
  AutomationActionType,
  AutomationConditionField,
  AutomationConditionOperator,
  AutomationTrigger,
} from '@veloxdesk/types';

export interface ConditionFormValue {
  field: AutomationConditionField;
  fieldId?: string;
  operator: AutomationConditionOperator;
  value: string;
}

export interface ActionFormValue {
  type: AutomationActionType;
  value?: string;
  fieldId?: string;
  formula?: string;
}

export interface RuleFormValues {
  name: string;
  trigger: AutomationTrigger;
  conditions: ConditionFormValue[];
  actions: ActionFormValue[];
}
