import { AutomationRuleEntity } from '@veloxdesk/database';
import { AutomationAction, AutomationCondition, AutomationTrigger } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface RuleWriteData {
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isEnabled: boolean;
  sortOrder: number;
}

@Injectable()
export class AutomationRulesRepository {
  constructor(
    @InjectRepository(AutomationRuleEntity)
    private readonly repository: Repository<AutomationRuleEntity>,
  ) {}

  create(data: RuleWriteData): Promise<AutomationRuleEntity> {
    return this.repository.save(this.repository.create(data));
  }

  findAll(): Promise<AutomationRuleEntity[]> {
    return this.repository.find({ order: { trigger: 'ASC', sortOrder: 'ASC' } });
  }

  findById(id: string): Promise<AutomationRuleEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  // The engine's hot path — only enabled rules for the trigger that just
  // fired, in execution order.
  findEnabledByTrigger(trigger: AutomationTrigger): Promise<AutomationRuleEntity[]> {
    return this.repository.find({
      where: { trigger, isEnabled: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async update(id: string, data: Partial<RuleWriteData>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
