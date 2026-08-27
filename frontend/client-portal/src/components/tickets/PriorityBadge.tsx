import type { TicketPriority } from '@veloxdesk/types';
import { useTranslation } from 'react-i18next';

const TEXT_CLASSES: Record<TicketPriority, string> = {
  low: 'text-priority-low',
  medium: 'text-priority-medium',
  high: 'text-priority-high',
  urgent: 'text-priority-urgent',
} as Record<TicketPriority, string>;

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const { t } = useTranslation();
  return <span className={`text-[12.5px] font-medium ${TEXT_CLASSES[priority]}`}>{t(`ticketPriority.${priority}`)}</span>;
}
