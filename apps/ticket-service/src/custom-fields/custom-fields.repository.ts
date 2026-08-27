import { CustomFieldDefinitionEntity, TicketCustomFieldValueEntity } from '@veloxdesk/database';
import { CustomFieldType } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class CustomFieldsRepository {
  constructor(
    @InjectRepository(CustomFieldDefinitionEntity)
    private readonly repository: Repository<CustomFieldDefinitionEntity>,
    @InjectRepository(TicketCustomFieldValueEntity)
    private readonly valuesRepository: Repository<TicketCustomFieldValueEntity>,
  ) {}

  create(data: {
    label: string;
    labelUk?: string;
    labelEn?: string;
    fieldType: CustomFieldType;
    options?: string[];
    pattern?: string;
    dependsOnFieldId?: string;
    conditionValue?: string;
    optionsByParent?: Record<string, string[]>;
  }): Promise<CustomFieldDefinitionEntity> {
    return this.repository.save(this.repository.create(data));
  }

  findAll(): Promise<CustomFieldDefinitionEntity[]> {
    return this.repository.find({ order: { label: 'ASC' } });
  }

  findById(id: string): Promise<CustomFieldDefinitionEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async update(
    id: string,
    data: Partial<{
      label: string;
      labelUk: string;
      labelEn: string;
      options: string[];
      pattern: string;
      dependsOnFieldId: string;
      conditionValue: string;
      optionsByParent: Record<string, string[]>;
    }>,
  ): Promise<void> {
    await this.repository.update({ id }, data);
  }

  // Backs the delete-field guard's rejection message only —
  // CustomFieldsService.removeDefinition() no longer uses this to DECIDE
  // whether to delete (see deleteIfUnused below for the actual atomic
  // guard); it's read afterward purely to report how many tickets reference
  // the field. Mirrors TagsRepository.countTicketsForTag()'s shape.
  countValuesForField(fieldId: string): Promise<number> {
    return this.valuesRepository.count({ where: { fieldId } });
  }

  // Atomic guarded delete — a separate countValuesForField() check followed
  // by a plain delete() left a TOCTOU window open: a value just saved for
  // this field (setValue's upsert landing between the count-check and the
  // delete) could get silently wiped, since ticket_custom_field_values.
  // field_id is ON DELETE CASCADE and would happily drop that brand-new row
  // too, with no error surfaced to either the admin or whoever just saved
  // the value. The NOT EXISTS subquery is evaluated by Postgres as part of
  // the same DELETE statement, not against an earlier read, so there's no
  // window for another transaction to slip a value row in between. Mirrors
  // TagsRepository.deleteIfUnused() exactly. Returns whether a row was
  // actually deleted.
  async deleteIfUnused(id: string): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(CustomFieldDefinitionEntity)
      .where('id = :id AND NOT EXISTS (SELECT 1 FROM ticket_custom_field_values WHERE field_id = :id)', { id })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
