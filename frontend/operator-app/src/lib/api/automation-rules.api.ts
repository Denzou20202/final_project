import { ticketApi } from './client.js';
import type { AutomationAction, AutomationCondition, AutomationTrigger, PublicAutomationRule } from '../types.js';

export async function listAutomationRules(): Promise<PublicAutomationRule[]> {
  const { data } = await ticketApi.get<PublicAutomationRule[]>('/automation-rules');
  return data;
}

export interface AutomationRuleInput {
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isEnabled?: boolean;
  sortOrder?: number;
}

export async function createAutomationRule(input: AutomationRuleInput): Promise<PublicAutomationRule> {
  const { data } = await ticketApi.post<PublicAutomationRule>('/automation-rules', input);
  return data;
}

export async function updateAutomationRule(
  id: string,
  input: Partial<AutomationRuleInput>,
): Promise<PublicAutomationRule> {
  const { data } = await ticketApi.patch<PublicAutomationRule>(`/automation-rules/${id}`, input);
  return data;
}

export async function deleteAutomationRule(id: string): Promise<void> {
  await ticketApi.delete(`/automation-rules/${id}`);
}
