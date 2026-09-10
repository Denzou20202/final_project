import { CustomFieldDefinitionEntity, TicketCustomFieldValueEntity } from '@veloxdesk/database';
import { CustomFieldType } from '@veloxdesk/types';

export interface PublicCustomFieldDefinition {
  id: string;
  label: string;
  labelUk: string | null;
  labelEn: string | null;
  fieldType: CustomFieldType;
  options: string[] | null;
  pattern: string | null;
  dependsOnFieldId: string | null;
  conditionValue: string | null;
  optionsByParent: Record<string, string[]> | null;
  createdAt: Date;
}

export function toPublicCustomFieldDefinition(field: CustomFieldDefinitionEntity): PublicCustomFieldDefinition {
  return {
    id: field.id,
    label: field.label,
    labelUk: field.labelUk ?? null,
    labelEn: field.labelEn ?? null,
    fieldType: field.fieldType,
    options: field.options ?? null,
    pattern: field.pattern ?? null,
    dependsOnFieldId: field.dependsOnFieldId ?? null,
    conditionValue: field.conditionValue ?? null,
    optionsByParent: field.optionsByParent ?? null,
    createdAt: field.createdAt,
  };
}

export interface PublicTicketCustomFieldValue {
  fieldId: string;
  value: string;
}

export function toPublicTicketCustomFieldValue(value: TicketCustomFieldValueEntity): PublicTicketCustomFieldValue {
  return {
    fieldId: value.fieldId,
    value: value.value,
  };
}
