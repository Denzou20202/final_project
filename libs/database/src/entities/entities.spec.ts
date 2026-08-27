import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { entities } from './index.js';

describe('database entities', () => {
  const entityClasses = entities;

  it('registers all tables from the ERD', () => {
    const tableNames = entityClasses
      .map((entityClass) => getMetadataArgsStorage().tables.find((t) => t.target === entityClass)?.name)
      .sort();

    expect(tableNames).toEqual(
      [
        'attachments',
        'automation_rules',
        'cities',
        'comments',
        'companies',
        'csat_answers',
        'csat_questions',
        'csat_surveys',
        'custom_field_definitions',
        'employee_status_history',
        'employee_statuses',
        'knowledge_articles',
        'knowledge_theme',
        'ldap_configs',
        'macros',
        'notifications',
        'oidc_configs',
        'permission_group_departments',
        'permission_groups',
        'presence_settings',
        'saved_reports',
        'settings_audit_log',
        'sla_policies',
        'tags',
        'team_members',
        'teams',
        'ticket_activities',
        'ticket_categories',
        'ticket_custom_field_values',
        'ticket_mentions',
        'ticket_statuses',
        'ticket_tags',
        'ticket_types',
        'ticket_watchers',
        'tickets',
        'user_extra_departments',
        'users',
      ].sort(),
    );
  });

  it('gives every table an explicit primary key', () => {
    for (const entityClass of entityClasses) {
      const columns = getMetadataArgsStorage().columns.filter((c) => c.target === entityClass);
      expect(columns.some((c) => c.options.primary)).toBe(true);
    }
  });
});
