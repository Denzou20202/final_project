import type { PublicTicketStatus } from '@veloxdesk/types';
import { useTranslation } from 'react-i18next';
import { pickLocalized } from '../../lib/localized.js';

// `unassigned` only ever changes anything while status is still the default
// (isDefault) one — a fresh ticket sits there unassigned until someone
// changes its status, which self-assigns them in the same action (see
// TicketsService.updateStatus's "self-assign on pickup" comment), so
// default+unassigned is the only combination that can actually occur.
// Purely cosmetic: the stored status doesn't change — there's no separate
// "unassigned" status value in the database (see the DropNewTicketStatus
// migration; «Неприсвоенные» is deliberately a filter, not a status). This
// just makes the badge agree with the «Неприсвоенные» sidebar folder the
// ticket is ALSO sitting in, instead of contradicting it with "В работе".
export function StatusBadge({ status, unassigned }: { status: PublicTicketStatus; unassigned?: boolean }) {
  const { t, i18n } = useTranslation();
  const showsAsUnassigned = !!unassigned && status.isDefault;
  const label = showsAsUnassigned
    ? t('ticketStatus.unassigned')
    : status.key
      ? t(`ticketStatus.${status.key}`)
      : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language);
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
      <span
        className={`h-1.5 w-1.5 rounded-sm ${showsAsUnassigned ? 'bg-status-new' : ''}`}
        style={showsAsUnassigned ? undefined : { backgroundColor: status.color }}
      />
      {label}
    </span>
  );
}
