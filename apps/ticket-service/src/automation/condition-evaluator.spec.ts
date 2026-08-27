import { AutomationConditionField, AutomationConditionOperator } from '@veloxdesk/types';
import { evaluateConditions } from './condition-evaluator.js';

const baseContext = { status: 'open', priority: 'high', teamId: 'team-1', customFieldValues: new Map<string, string>() };

describe('evaluateConditions', () => {
  it('matches when every condition matches (AND-only)', () => {
    const result = evaluateConditions(
      [
        { field: AutomationConditionField.STATUS, operator: AutomationConditionOperator.EQUALS, value: 'open' },
        { field: AutomationConditionField.PRIORITY, operator: AutomationConditionOperator.EQUALS, value: 'high' },
      ],
      baseContext,
    );
    expect(result).toBe(true);
  });

  it('fails when any single condition fails', () => {
    const result = evaluateConditions(
      [
        { field: AutomationConditionField.STATUS, operator: AutomationConditionOperator.EQUALS, value: 'open' },
        { field: AutomationConditionField.PRIORITY, operator: AutomationConditionOperator.EQUALS, value: 'urgent' },
      ],
      baseContext,
    );
    expect(result).toBe(false);
  });

  it('an empty condition list always matches (rule applies unconditionally)', () => {
    expect(evaluateConditions([], baseContext)).toBe(true);
  });

  it('neq on an unset custom field matches (absence is trivially "not equal")', () => {
    const result = evaluateConditions(
      [{ field: AutomationConditionField.CUSTOM_FIELD, fieldId: 'f1', operator: AutomationConditionOperator.NOT_EQUALS, value: 'x' }],
      baseContext,
    );
    expect(result).toBe(true);
  });

  it('eq on an unset custom field never matches', () => {
    const result = evaluateConditions(
      [{ field: AutomationConditionField.CUSTOM_FIELD, fieldId: 'f1', operator: AutomationConditionOperator.EQUALS, value: 'x' }],
      baseContext,
    );
    expect(result).toBe(false);
  });

  it('reads custom field values from the context map by fieldId', () => {
    const context = { ...baseContext, customFieldValues: new Map([['f1', 'gold']]) };
    const result = evaluateConditions(
      [{ field: AutomationConditionField.CUSTOM_FIELD, fieldId: 'f1', operator: AutomationConditionOperator.EQUALS, value: 'gold' }],
      context,
    );
    expect(result).toBe(true);
  });

  it('treats an unassigned team (null) as absent for TEAM_ID conditions', () => {
    const context = { ...baseContext, teamId: null };
    expect(
      evaluateConditions([{ field: AutomationConditionField.TEAM_ID, operator: AutomationConditionOperator.NOT_EQUALS, value: 'team-1' }], context),
    ).toBe(true);
    expect(
      evaluateConditions([{ field: AutomationConditionField.TEAM_ID, operator: AutomationConditionOperator.EQUALS, value: 'team-1' }], context),
    ).toBe(false);
  });
});
