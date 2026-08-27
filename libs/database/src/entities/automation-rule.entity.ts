import { AutomationCondition, AutomationAction, AutomationTrigger } from '@veloxdesk/types';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Admin-managed "Dispatcher" rule: on `trigger`, if every entry in
// `conditions` matches (AND-only, no OR/nesting in v1), run `actions` in
// order. conditions/actions are never queried by content from SQL — the
// engine always loads the small set of enabled rules for a trigger and
// evaluates them in application code — so plain jsonb (no GIN index) is the
// right call here, not a normalized rows-per-condition schema.
@Entity('automation_rules')
@Index(['trigger', 'isEnabled'])
export class AutomationRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'enum', enum: AutomationTrigger })
  trigger!: AutomationTrigger;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  conditions!: AutomationCondition[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  actions!: AutomationAction[];

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  // Execution order among rules sharing the same trigger — lower runs
  // first. Later rules see the effects of earlier ones (e.g. a status set
  // by rule #1 is visible to rule #2's condition check).
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
