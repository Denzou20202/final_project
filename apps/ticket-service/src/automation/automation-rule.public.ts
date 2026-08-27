import { AutomationRuleEntity } from '@veloxdesk/database';
import { AutomationAction, AutomationCondition, AutomationTrigger } from '@veloxdesk/types';

export interface PublicAutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isEnabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicAutomationRule(rule: AutomationRuleEntity): PublicAutomationRule {
  return {
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    conditions: rule.conditions,
    actions: rule.actions,
    isEnabled: rule.isEnabled,
    sortOrder: rule.sortOrder,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}
