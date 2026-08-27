import type { TicketPriority } from '@veloxdesk/types';
import { useTranslation } from 'react-i18next';
import {
  useAssignTicket,
  useAssignTicketTeam,
  useRestoreTicket,
  useUpdateTicketCategory,
  useUpdateTicketPriority,
  useUpdateTicketStatus,
  useUpdateTicketType,
} from '../../hooks/useTickets.js';
import { useSlaPolicies } from '../../hooks/useSlaPolicies.js';
import { useTeams } from '../../hooks/useTeams.js';
import { useTicketCategories } from '../../hooks/useTicketCategories.js';
import { useTicketStatuses } from '../../hooks/useTicketStatuses.js';
import { useTicketTypes } from '../../hooks/useTicketTypes.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/format.js';
import { PRIORITY_OPTIONS } from '../../lib/labels.js';
import { pickLocalized } from '../../lib/localized.js';
import { isAssignableStaff } from '../../lib/staff.js';
import type { PublicTicket } from '../../lib/types.js';
import { CsatSection } from './CsatSection.js';
import { CustomFieldsSection } from './CustomFieldsSection.js';
import { TagsSection } from './TagsSection.js';

// The SLA clock always runs from the ticket's original createdAt (see
// SlaEscalationService on the backend) — deadlines are computed the same
// way here, not stored separately.
function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function TicketAttributesPanel({ ticket }: { ticket: PublicTicket }) {
  const { t, i18n } = useTranslation();
  const updateStatus = useUpdateTicketStatus();
  const updatePriority = useUpdateTicketPriority();
  const updateType = useUpdateTicketType();
  const updateCategory = useUpdateTicketCategory();
  const assign = useAssignTicket();
  const assignTeam = useAssignTicketTeam();
  const restoreTicket = useRestoreTicket();
  const { data: usersPage } = useAssignableUsers();
  const { data: slaPolicies } = useSlaPolicies();
  const { data: teams } = useTeams();
  const { data: categories } = useTicketCategories();
  const { data: statuses } = useTicketStatuses();
  const { data: types } = useTicketTypes();
  // Viewing a trashed ticket works (see tickets.service.ts's includeDeleted
  // reads), but every mutation endpoint still 404s until it's restored —
  // these controls are disabled to match, instead of failing silently.
  const isDeleted = !!ticket.deletedAt;

  // isAssignableStaff plus one exception: whoever is ALREADY assigned to
  // this ticket stays in the list even if they've since been deactivated or
  // moved to a «наблюдатель» group — otherwise the select would silently
  // fall back to an unselected/blank state.
  const assignableOperators = (usersPage?.items ?? []).filter(
    (u) => isAssignableStaff(u) || u.id === ticket.assignedTo,
  );
  const slaPolicy = slaPolicies?.find((p) => p.id === ticket.slaPolicyId);

  const statusError = updateStatus.error ? getErrorMessage(updateStatus.error) : undefined;

  return (
    <aside className="flex w-80 flex-none flex-col overflow-y-auto border-l border-border bg-surface-sidebar">
      {isDeleted && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-priority-urgent/10 p-4">
          <span className="text-[12.5px] font-medium text-priority-urgent">{t('ticketFields.deletedBanner')}</span>
          <button
            type="button"
            onClick={() => restoreTicket.mutate({ id: ticket.id, args: [] })}
            disabled={restoreTicket.isPending}
            className="flex-none rounded-lg border border-priority-urgent/30 px-2.5 py-1 text-[12px] font-medium text-priority-urgent hover:bg-priority-urgent/5 disabled:opacity-50"
          >
            {t('trash.restore')}
          </button>
        </div>
      )}
      <div className="border-b border-border p-4">
        <label htmlFor="team" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          {t('ticketFields.team')}
        </label>
        <select
          id="team"
          value={ticket.teamId ?? ''}
          disabled={isDeleted || assignTeam.isPending}
          onChange={(e) => e.target.value && assignTeam.mutate({ id: ticket.id, args: [e.target.value] })}
          className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none disabled:opacity-50"
        >
          <option value="" disabled>
            {t('ticketFields.notAssigned')}
          </option>
          {(teams ?? []).map((team) => (
            <option key={team.id} value={team.id}>
              {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
            </option>
          ))}
        </select>
      </div>

      <div className="border-b border-border p-4">
        <label htmlFor="assignee" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          {t('ticketFields.assignee')}
        </label>
        <select
          id="assignee"
          value={ticket.assignedTo ?? ''}
          disabled={isDeleted || assign.isPending}
          onChange={(e) => e.target.value && assign.mutate({ id: ticket.id, args: [e.target.value] })}
          className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none disabled:opacity-50"
        >
          <option value="" disabled>
            {t('ticketFields.notAssigned')}
          </option>
          {assignableOperators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.fullName}
              {operator.deactivatedAt ? t('ticketFields.deactivatedSuffix') : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="border-b border-border p-4">
        <label htmlFor="status" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          {t('ticketFields.status')}
        </label>
        <select
          id="status"
          value={ticket.status.id}
          disabled={isDeleted || updateStatus.isPending}
          onChange={(e) => updateStatus.mutate({ id: ticket.id, args: [e.target.value] })}
          className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none disabled:opacity-50"
        >
          {(statuses ?? []).map((status) => {
            // Server rejects a manual close (any isClosed status) without
            // an assignee (see TicketsService.assertAssignedForClose) —
            // disabling it here keeps the operator from hitting that as a
            // surprise error after the fact.
            const blockedByAssignee = status.isClosed && !ticket.assignedTo;
            // The ticket's own current status is labeled the same
            // "Неприсвоенная" way the header badge (StatusBadge,
            // unassigned={!ticket.assignedTo}) already does, or this
            // dropdown silently contradicts what's shown right next to it
            // for a default-status, unassigned ticket.
            const showsAsUnassigned = status.id === ticket.status.id && status.isDefault && !ticket.assignedTo;
            return (
              <option
                key={status.id}
                value={status.id}
                disabled={blockedByAssignee}
                title={blockedByAssignee ? t('ticketFields.closeBlockedTitle') : undefined}
              >
                {showsAsUnassigned
                  ? t('ticketStatus.unassigned')
                  : status.key
                    ? t(`ticketStatus.${status.key}`)
                    : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}
              </option>
            );
          })}
        </select>
        {!ticket.assignedTo && (
          <p className="mt-1.5 text-xs text-priority-medium">{t('ticketFields.closeRequiresAssignee')}</p>
        )}
        {statusError && <p className="mt-1.5 text-xs text-priority-urgent">{statusError}</p>}
      </div>

      <div className="border-b border-border p-4">
        <label htmlFor="priority" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          {t('ticketFields.priority')}
        </label>
        <select
          id="priority"
          value={ticket.priority}
          disabled={isDeleted || updatePriority.isPending}
          onChange={(e) => updatePriority.mutate({ id: ticket.id, args: [e.target.value as TicketPriority] })}
          className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none disabled:opacity-50"
        >
          {PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {t(`ticketPriority.${priority}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="border-b border-border p-4">
        <label htmlFor="type" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          {t('ticketFields.type')}
        </label>
        <select
          id="type"
          value={ticket.type.id}
          disabled={isDeleted || updateType.isPending}
          onChange={(e) => updateType.mutate({ id: ticket.id, args: [e.target.value] })}
          className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none disabled:opacity-50"
        >
          {(types ?? []).map((type) => (
            <option key={type.id} value={type.id}>
              {type.key ? t(`ticketType.${type.key}`) : pickLocalized(type.name, type.nameUk, type.nameEn, i18n.language)}
            </option>
          ))}
        </select>
      </div>

      <div className="border-b border-border p-4">
        <label htmlFor="category" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          {t('ticketFields.category')}
        </label>
        <select
          id="category"
          value={ticket.categoryId ?? ''}
          disabled={isDeleted || updateCategory.isPending}
          onChange={(e) => updateCategory.mutate({ id: ticket.id, args: [e.target.value || null] })}
          className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none disabled:opacity-50"
        >
          <option value="">{t('ticketFields.noCategory')}</option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {pickLocalized(category.name, category.nameUk, category.nameEn, i18n.language)}
            </option>
          ))}
        </select>
      </div>

      <CustomFieldsSection ticketId={ticket.id} />

      {slaPolicy && (
        <div className="border-b border-border p-4">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('ticketFields.sla')}</div>
          <div className="text-[13px] text-ink-muted">{slaPolicy.name}</div>
          <div className="mt-1 flex flex-col gap-0.5 text-[12px] text-ink-faint">
            <span>
              {t('ticketFields.responseBy', {
                date: formatDateTime(addMinutes(ticket.createdAt, slaPolicy.responseTimeMin)),
              })}
            </span>
            <span>
              {t('ticketFields.resolutionBy', {
                date: formatDateTime(addMinutes(ticket.createdAt, slaPolicy.resolutionTimeMin)),
              })}
            </span>
          </div>
        </div>
      )}

      <TagsSection ticketId={ticket.id} />

      <CsatSection ticketId={ticket.id} status={ticket.status} />
    </aside>
  );
}
