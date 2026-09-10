import { ticketApi } from './client.js';
import type { CustomFieldType, PublicCustomFieldDefinition, PublicTicketCustomFieldValue } from '../types.js';

export async function listCustomFieldDefinitions(): Promise<PublicCustomFieldDefinition[]> {
  const { data } = await ticketApi.get<PublicCustomFieldDefinition[]>('/custom-fields');
  return data;
}

export interface CustomFieldDefinitionInput {
  label: string;
  labelUk?: string;
  labelEn?: string;
  fieldType: CustomFieldType;
  options?: string[];
  pattern?: string;
  dependsOnFieldId?: string;
  conditionValue?: string;
  optionsByParent?: Record<string, string[]>;
}

export async function createCustomFieldDefinition(
  input: CustomFieldDefinitionInput,
): Promise<PublicCustomFieldDefinition> {
  const { data } = await ticketApi.post<PublicCustomFieldDefinition>('/custom-fields', input);
  return data;
}

export async function updateCustomFieldDefinition(
  id: string,
  input: Partial<Omit<CustomFieldDefinitionInput, 'fieldType'>>,
): Promise<PublicCustomFieldDefinition> {
  const { data } = await ticketApi.patch<PublicCustomFieldDefinition>(`/custom-fields/${id}`, input);
  return data;
}

export async function deleteCustomFieldDefinition(id: string): Promise<void> {
  await ticketApi.delete(`/custom-fields/${id}`);
}

export async function listTicketCustomFieldValues(ticketId: string): Promise<PublicTicketCustomFieldValue[]> {
  const { data } = await ticketApi.get<PublicTicketCustomFieldValue[]>(`/tickets/${ticketId}/custom-field-values`);
  return data;
}

export async function setTicketCustomFieldValue(ticketId: string, fieldId: string, value: string): Promise<void> {
  await ticketApi.put(`/tickets/${ticketId}/custom-field-values/${fieldId}`, { value });
}
