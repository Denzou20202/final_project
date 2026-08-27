import type { PublicTicketStatus } from '@veloxdesk/types';
import { useTranslation } from 'react-i18next';
import { pickLocalized } from '../../lib/localized.js';

// `unassigned` only ever changes anything while status is still the default
// one — a fresh ticket shows as «Новые» to the client until staff picks it
// up (assigns it internally), at which point it reads the default status's
// own label. Purely cosmetic, same as operator-app's own StatusBadge: the
// stored status doesn't change, there's no separate "new" status value in
// the database (see the DropNewTicketStatus migration).
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
