import { CustomFieldType } from '@veloxdesk/types';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

// Admin-managed field definitions attached to every ticket (e.g. "Номер
// договора", "Версия ПО"). `options` only applies to SELECT fields — a
// plain string array of the allowed choices.
@Entity('custom_field_definitions')
export class CustomFieldDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  // Auto-filled via DeepL on create/edit, editable before save — see
  // TicketStatusEntity.nameUk's comment for the full rationale. Only the
  // label translates; `options`/`optionsByParent` below stay admin-language-
  // only by design (the user's own request — dropdown VALUES are the
  // admin's call, not machine-translated).
  @Column({ name: 'label_uk', type: 'varchar', length: 255, nullable: true })
  labelUk?: string | null;

  @Column({ name: 'label_en', type: 'varchar', length: 255, nullable: true })
  labelEn?: string | null;

  @Column({ name: 'field_type', type: 'enum', enum: CustomFieldType })
  fieldType!: CustomFieldType;

  @Column({ type: 'jsonb', nullable: true })
  options?: string[] | null;

  // REGEX fields only — validated to compile as a real RegExp at
  // create/update time (see CustomFieldsService).
  @Column({ type: 'varchar', length: 500, nullable: true })
  pattern?: string | null;

  // The single field this one's behavior depends on — doubles for two
  // independent mechanisms below, which may be used together or apart. SET
  // NULL (not CASCADE) on the referenced field's deletion: a dependent
  // field should fall back to always-visible/flat-options rather than
  // vanish or block the parent's deletion.
  @Column({ name: 'depends_on_field_id', type: 'uuid', nullable: true })
  dependsOnFieldId?: string | null;

  @ManyToOne(() => CustomFieldDefinitionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'depends_on_field_id' })
  dependsOnField?: CustomFieldDefinitionEntity;

  // Conditional visibility: this field is only shown once dependsOnFieldId's
  // current value on the ticket equals this string. Independent of
  // optionsByParent below — a field can use either, both, or neither.
  @Column({ name: 'condition_value', type: 'varchar', length: 255, nullable: true })
  conditionValue?: string | null;

  // Hierarchical dropdown ("category → subcategory"): only meaningful when
  // this field AND dependsOnField are both SELECT — maps the parent's
  // currently-selected option to this field's own allowed options, instead
  // of the flat `options` list above.
  @Column({ name: 'options_by_parent', type: 'jsonb', nullable: true })
  optionsByParent?: Record<string, string[]> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
