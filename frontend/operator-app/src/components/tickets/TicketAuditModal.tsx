import type { TFunction } from 'i18next';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from '../common/icons.js';
import { RoleBadge } from '../common/RoleBadge.js';
import { useUserLookup, useUserRoleLookup } from '../../hooks/useUserLookup.js';
import { useTicketActivity } from '../../hooks/useTickets.js';
import { useTicketStatuses } from '../../hooks/useTicketStatuses.js';
import { useTicketTypes } from '../../hooks/useTicketTypes.js';
import { formatDateTime } from '../../lib/format.js';
import { pickLocalized } from '../../lib/localized.js';
import type { PublicTicketActivity, PublicTicketStatus, PublicTicketType } from '../../lib/types.js';

// Status fromValue/toValue used to be a frozen display name (never
// translates, and for an admin-created custom status, never even had a
// `key` to fall back on) — now they're the status's id, resolved here
// against the live statuses list so this always shows the CURRENT locale's
// name. Old, pre-fix activity rows still hold a literal name string that
// won't match any id in statusesById — falls through to the raw stored
// value unchanged, same as before this fix, so historical entries keep
// showing exactly what they always did.
const statusLabel = (
  t: TFunction,
  value: string | null,
  statusesById: Map<string, PublicTicketStatus>,
  locale: string,
) => {
  if (!value) return value;
  const status = statusesById.get(value);
  if (!status) return value;
  return status.key ? t(`ticketStatus.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, locale);
};
const priorityLabel = (t: TFunction, value: string | null) =>
  value ? t(`ticketPriority.${value}`, { defaultValue: value }) : value;
// Same resolve-by-id-against-the-live-catalog shape as statusLabel above —
// type fromValue/toValue are ticket_types row ids since the TicketType->
// catalog conversion, not raw enum strings. Old, pre-conversion activity
// rows still hold a literal enum string ('incident' etc.) that won't match
// any id in typesById — falls through to the raw stored value unchanged.
const typeLabel = (t: TFunction, value: string | null, typesById: Map<string, PublicTicketType>, locale: string) => {
  if (!value) return value;
  const type = typesById.get(value);
  if (!type) return value;
  return type.key ? t(`ticketType.${type.key}`) : pickLocalized(type.name, type.nameUk, type.nameEn, locale);
};

// Built inside the component (not a module-level map) since every entry
// needs the active-language `t` — see getActivityLabel below.
function getActivityLabel(
  t: TFunction,
  entry: PublicTicketActivity,
  statusesById: Map<string, PublicTicketStatus>,
  typesById: Map<string, PublicTicketType>,
  locale: string,
): string {
  switch (entry.type) {
    case 'created':
      return t('activity.created');
    case 'status_changed':
      return t('activity.statusChanged', {
        from: statusLabel(t, entry.fromValue, statusesById, locale),
        to: statusLabel(t, entry.toValue, statusesById, locale),
      });
    case 'priority_changed':
      return t('activity.priorityChanged', {
        from: priorityLabel(t, entry.fromValue),
        to: priorityLabel(t, entry.toValue),
      });
    case 'assigned':
      return t('activity.assigned');
    case 'unassigned':
      return t('activity.unassigned');
    case 'edited':
      switch (entry.field) {
        case 'title':
          return t('activity.titleChanged');
        case 'description':
          return t('activity.descriptionChanged');
        case 'type':
          return t('activity.typeChanged', {
            from: typeLabel(t, entry.fromValue, typesById, locale),
            to: typeLabel(t, entry.toValue, typesById, locale),
          });
        case 'team':
          return t('activity.teamChanged', { from: entry.fromValue ?? '—', to: entry.toValue ?? '—' });
        default:
          // Pre-migration rows have no field — keep the old generic label.
          return t('activity.edited');
      }
    case 'message_edited':
      return t('activity.messageEdited');
    case 'attachment_added':
      return t('activity.attachmentAdded', { name: entry.toValue });
    case 'sla_response_breached':
      return t('activity.slaResponseBreached');
    case 'sla_resolution_breached':
      return t('activity.slaResolutionBreached');
    case 'tag_added':
      return t('activity.tagAdded', { name: entry.toValue });
    case 'tag_removed':
      return t('activity.tagRemoved', { name: entry.fromValue });
    case 'merged_into':
      // Historical rows logged this same type for both sides of a merge,
      // distinguished only by which value was set — merged_from (below) is
      // the target-side type going forward, but old target-side rows still
      // carry 'merged_into' with only fromValue set, so this fallback stays.
      return entry.toValue
        ? t('activity.mergedInto', { number: entry.toValue })
        : t('activity.mergedFrom', { number: entry.fromValue });
    case 'merged_from':
      return t('activity.mergedFrom', { number: entry.fromValue });
    case 'deleted':
      return t('activity.deleted');
    case 'restored':
      return t('activity.restored');
    case 'status_email_sent':
      return t('activity.statusEmailSent', { status: statusLabel(t, entry.toValue, statusesById, locale) });
    case 'csat_submitted':
      return t('activity.csatSubmitted', { score: entry.toValue });
    default:
      return entry.type;
  }
}

// title/description/message edits carry free-form text worth showing in
// full — status/priority/type/team changes are already a complete sentence
// via the {{from}}/{{to}} interpolation in getActivityLabel above, so they
// don't need a second block repeating the same two values.
function getEditDiff(entry: PublicTicketActivity): { from: string | null; to: string | null; html: boolean } | null {
  if (entry.type === 'message_edited') {
    // Chat message bodies are sanitized server-side before storage (same
    // string already rendered live in the thread) — safe to render as-is.
    return { from: entry.fromValue, to: entry.toValue, html: true };
  }
  if (entry.type === 'edited' && (entry.field === 'title' || entry.field === 'description')) {
    return { from: entry.fromValue, to: entry.toValue, html: false };
  }
  return null;
}

const BREACH_ACTIVITY_TYPES = new Set(['sla_response_breached', 'sla_resolution_breached']);

function DiffText({ value, html }: { value: string; html: boolean }) {
  if (html) {
    return <div className="whitespace-pre-wrap break-words text-[12.5px]" dangerouslySetInnerHTML={{ __html: value }} />;
  }
  return <div className="whitespace-pre-wrap break-words text-[12.5px]">{value}</div>;
}

export function TicketAuditModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lookupUser = useUserLookup();
  const lookupRole = useUserRoleLookup();
  // Own subscription rather than reusing the ticket page's already-fetched
  // activity list — that one loads once when the ticket page mounts, so an
  // edit made afterwards (e.g. editing a chat message while the page stays
  // open) would never show up here without this. staleTime is 0 (default),
  // so mounting this query fresh on every modal open refetches in the
  // background — same query key, so this doesn't duplicate the request the
  // page itself still makes for the "Аудит (N)" button count.
  const { data: activity } = useTicketActivity(ticketId);
  const { data: statuses } = useTicketStatuses();
  const { data: types } = useTicketTypes();
  const statusesById = useMemo(() => new Map((statuses ?? []).map((s) => [s.id, s])), [statuses]);
  const typesById = useMemo(() => new Map((types ?? []).map((tt) => [tt.id, tt])), [types]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-lg sm:h-[75vh] sm:w-[75vw] sm:rounded-2xl sm:border sm:border-border">
        <div className="flex flex-none items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-base font-bold">
            {t('ticketDetail.audit')}
            {activity && activity.length > 0 ? ` (${activity.length})` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            title={t('common.close')}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-priority-urgent"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {(activity ?? []).map((entry) => {
            const diff = getEditDiff(entry);
            const role = entry.actorId ? lookupRole(entry.actorId) : undefined;
            return (
              <li key={entry.id} className="border-b border-border py-3 first:pt-0 last:border-0">
                <div
                  className={`text-[12.5px] ${
                    BREACH_ACTIVITY_TYPES.has(entry.type) ? 'font-medium text-priority-urgent' : 'text-ink-muted'
                  }`}
                >
                  {getActivityLabel(t, entry, statusesById, typesById, i18n.language)}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                  <span>{formatDateTime(entry.createdAt, i18n.language)}</span>
                  <span>·</span>
                  <span>{entry.actorId ? lookupUser(entry.actorId) : t('ticketDetail.system')}</span>
                  {role && <RoleBadge role={role} />}
                </div>
                {diff && (diff.from || diff.to) && (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg bg-surface-muted p-2.5">
                    {diff.from && (
                      <div>
                        <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                          {t('ticketDetail.auditWas')}
                        </div>
                        <div className="text-ink-subtle line-through decoration-ink-faint/40">
                          <DiffText value={diff.from} html={diff.html} />
                        </div>
                      </div>
                    )}
                    {diff.to && (
                      <div>
                        <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                          {t('ticketDetail.auditBecame')}
                        </div>
                        <div className="text-ink">
                          <DiffText value={diff.to} html={diff.html} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {activity?.length === 0 && <li className="text-[12.5px] text-ink-faint">{t('ticketDetail.auditEmpty')}</li>}
        </ul>
      </div>
    </div>
  );
}
