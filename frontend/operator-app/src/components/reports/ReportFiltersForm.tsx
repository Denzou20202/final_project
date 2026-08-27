import type { ReportDateField, TicketPriority } from '@veloxdesk/types';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../hooks/useCompanies.js';
import { useCustomFieldDefinitions } from '../../hooks/useCustomFields.js';
import { useAllTags } from '../../hooks/useTags.js';
import { useTeams } from '../../hooks/useTeams.js';
import { useTicketCategories } from '../../hooks/useTicketCategories.js';
import { useTicketStatuses } from '../../hooks/useTicketStatuses.js';
import { useTicketTypes } from '../../hooks/useTicketTypes.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { endOfLocalDay, startOfLocalDay, toLocalDateInputValue } from '../../lib/format.js';
import { PRIORITY_OPTIONS } from '../../lib/labels.js';
import { pickLocalized } from '../../lib/localized.js';
import type { ReportFilters } from '../../lib/types.js';
import { ClientSearchSelect } from './ClientSearchSelect.js';

const DATE_FIELD_OPTIONS: ReportDateField[] = [
  'created' as ReportDateField,
  'created_or_closed' as ReportDateField,
  'updated' as ReportDateField,
  'closed' as ReportDateField,
];

// The filter half of the report constructor's state — everything except
// groupBy, which only the constructor itself (and DynamicsReportView, fixed
// to 'period') cares about. Shared by the constructor, «Экспорт заявок» and
// «Отчёт в динамике» so all three filter tickets identically.
export interface ReportFiltersValue {
  statusIds: string[];
  priorities: TicketPriority[];
  typeIds: string[];
  teamId: string;
  assigneeId: string;
  clientId: string;
  company: string;
  tagId: string;
  categoryId: string;
  customFieldId: string;
  customFieldValue: string;
  dateField: ReportDateField;
  from: string;
  to: string;
}

export const DEFAULT_REPORT_FILTERS: ReportFiltersValue = {
  statusIds: [],
  priorities: [],
  typeIds: [],
  teamId: '',
  assigneeId: '',
  clientId: '',
  company: '',
  tagId: '',
  categoryId: '',
  customFieldId: '',
  customFieldValue: '',
  dateField: 'created' as ReportDateField,
  from: '',
  to: '',
};

export function formValueToFilters(value: ReportFiltersValue): ReportFilters {
  return {
    statusIds: value.statusIds.length ? value.statusIds : undefined,
    priorities: value.priorities.length ? value.priorities : undefined,
    typeIds: value.typeIds.length ? value.typeIds : undefined,
    teamId: value.teamId || undefined,
    assigneeId: value.assigneeId || undefined,
    clientId: value.clientId || undefined,
    company: value.company || undefined,
    tagId: value.tagId || undefined,
    categoryId: value.categoryId || undefined,
    // Both or neither — a field chosen with no value (or vice versa) isn't
    // a meaningful filter, so it's dropped rather than sent half-formed.
    customFieldId: value.customFieldId && value.customFieldValue ? value.customFieldId : undefined,
    customFieldValue: value.customFieldId && value.customFieldValue ? value.customFieldValue : undefined,
    dateField: value.dateField,
    from: value.from ? startOfLocalDay(value.from).toISOString() : undefined,
    to: value.to ? endOfLocalDay(value.to).toISOString() : undefined,
  };
}

export function filtersToFormValue(filters: ReportFilters): ReportFiltersValue {
  return {
    statusIds: filters.statusIds ?? [],
    priorities: filters.priorities ?? [],
    typeIds: filters.typeIds ?? [],
    teamId: filters.teamId ?? '',
    assigneeId: filters.assigneeId ?? '',
    clientId: filters.clientId ?? '',
    company: filters.company ?? '',
    tagId: filters.tagId ?? '',
    categoryId: filters.categoryId ?? '',
    customFieldId: filters.customFieldId ?? '',
    customFieldValue: filters.customFieldValue ?? '',
    dateField: filters.dateField ?? ('created' as ReportDateField),
    from: filters.from ? toLocalDateInputValue(filters.from) : '',
    to: filters.to ? toLocalDateInputValue(filters.to) : '',
  };
}

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function MultiToggleGroup<T extends string>({
  label,
  options,
  labelKeyPrefix,
  renderLabel,
  selected,
  onToggle,
}: {
  label: string;
  options: T[];
  // Either a static i18n-key prefix (priority/type — a fixed enum) or a
  // per-option renderer (status — an admin-editable catalog with no i18n
  // key for custom entries, see the status usage below).
  labelKeyPrefix?: string;
  renderLabel?: (option: T) => ReactNode;
  selected: T[];
  onToggle: (value: T) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-border text-ink-muted hover:bg-surface-muted'
              }`}
            >
              {renderLabel ? renderLabel(option) : t(`${labelKeyPrefix}.${option}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReportFiltersForm({
  value,
  onChange,
}: {
  value: ReportFiltersValue;
  onChange: (changes: Partial<ReportFiltersValue>) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: teams } = useTeams();
  const { data: tags } = useAllTags();
  const { data: categories } = useTicketCategories();
  const { data: statuses } = useTicketStatuses();
  const { data: types } = useTicketTypes();
  const { data: usersPage } = useAssignableUsers();
  const { data: companiesCatalog } = useCompanies();
  const { data: customFields } = useCustomFieldDefinitions();
  const statusById = useMemo(() => new Map((statuses ?? []).map((s) => [s.id, s])), [statuses]);
  const typeById = useMemo(() => new Map((types ?? []).map((t) => [t.id, t])), [types]);

  // Staff count is small at this deployment's scale (10-50 operators, see
  // useAssignableUsers's own comment) — the single capped page is fine
  // here. Client selection uses ClientSearchSelect below instead (async
  // server-side search), and the company list now comes from the admin
  // catalog (useCompanies) rather than being derived from this same capped
  // page — with 1000+ real clients, deriving distinct companies from only
  // the first ~100 of them used to silently hide the rest.
  const staff = (usersPage?.items ?? []).filter((u) => u.role !== 'client' && !u.deactivatedAt);
  const companies = useMemo(
    () => [...(companiesCatalog ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [companiesCatalog],
  );
  const selectedCustomField = useMemo(
    () => customFields?.find((f) => f.id === value.customFieldId),
    [customFields, value.customFieldId],
  );

  return (
    <>
      <MultiToggleGroup
        label={t('ticketFields.status')}
        options={(statuses ?? []).map((s) => s.id)}
        renderLabel={(id) => {
          const status = statusById.get(id);
          if (!status) return id;
          return (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: status.color }} />
              {status.key ? t(`ticketStatus.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}
            </span>
          );
        }}
        selected={value.statusIds}
        onToggle={(v) => onChange({ statusIds: toggleInArray(value.statusIds, v) })}
      />
      <MultiToggleGroup
        label={t('ticketFields.priority')}
        options={PRIORITY_OPTIONS}
        labelKeyPrefix="ticketPriority"
        selected={value.priorities}
        onToggle={(v) => onChange({ priorities: toggleInArray(value.priorities, v) })}
      />
      <MultiToggleGroup
        label={t('ticketFields.type')}
        options={(types ?? []).map((tt) => tt.id)}
        renderLabel={(id) => {
          const type = typeById.get(id);
          if (!type) return id;
          return (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: type.color }} />
              {type.key ? t(`ticketType.${type.key}`) : pickLocalized(type.name, type.nameUk, type.nameEn, i18n.language)}
            </span>
          );
        }}
        selected={value.typeIds}
        onToggle={(v) => onChange({ typeIds: toggleInArray(value.typeIds, v) })}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('ticketFields.team')}
          </label>
          <select
            value={value.teamId}
            onChange={(e) => onChange({ teamId: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
          >
            <option value="">{t('reports.all')}</option>
            {(teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('ticketFields.assignee')}
          </label>
          <select
            value={value.assigneeId}
            onChange={(e) => onChange({ assigneeId: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
          >
            <option value="">{t('reports.all')}</option>
            {staff.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('ticketDetail.client')}
          </label>
          <ClientSearchSelect value={value.clientId} onChange={(clientId) => onChange({ clientId })} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('reports.tagLabel')}
          </label>
          <select
            value={value.tagId}
            onChange={(e) => onChange({ tagId: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
          >
            <option value="">{t('reports.anyTag')}</option>
            {(tags ?? []).map((tag) => (
              <option key={tag.id} value={tag.id}>
                {pickLocalized(tag.name, tag.nameUk, tag.nameEn, i18n.language)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('ticketDetail.company')}
          </label>
          <select
            value={value.company}
            onChange={(e) => onChange({ company: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
          >
            <option value="">{t('reports.all')}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.name}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('reports.categoryLabel')}
          </label>
          <select
            value={value.categoryId}
            onChange={(e) => onChange({ categoryId: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
          >
            <option value="">{t('reports.anyCategory')}</option>
            {(categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {pickLocalized(category.name, category.nameUk, category.nameEn, i18n.language)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('reports.customFieldLabel')}
          </label>
          <select
            value={value.customFieldId}
            onChange={(e) => onChange({ customFieldId: e.target.value, customFieldValue: '' })}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
          >
            <option value="">{t('reports.all')}</option>
            {(customFields ?? []).map((field) => (
              <option key={field.id} value={field.id}>
                {pickLocalized(field.label, field.labelUk, field.labelEn, i18n.language)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('reports.customFieldValueLabel')}
          </label>
          {selectedCustomField?.options?.length ? (
            <select
              value={value.customFieldValue}
              onChange={(e) => onChange({ customFieldValue: e.target.value })}
              disabled={!value.customFieldId}
              className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600 disabled:opacity-50"
            >
              <option value="">{t('reports.all')}</option>
              {selectedCustomField.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value.customFieldValue}
              onChange={(e) => onChange({ customFieldValue: e.target.value })}
              disabled={!value.customFieldId}
              className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600 disabled:opacity-50"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('reports.periodByLabel')}
          </label>
          <select
            value={value.dateField}
            onChange={(e) => onChange({ dateField: e.target.value as ReportDateField })}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
          >
            {DATE_FIELD_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {t(`reportDateField.${v}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('reports.fromLabel')}
          </label>
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ from: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('reports.toLabel')}
          </label>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ to: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
          />
        </div>
      </div>
    </>
  );
}
