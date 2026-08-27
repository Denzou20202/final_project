import type { TicketPriority, UserRole } from '@veloxdesk/types';

// The single source of Russian display names for the core ticket enums.
// These used to be re-declared per page/component; an earlier rename sweep
// («Закрыто» → «Завершено») had to touch half a dozen copies to stay
// consistent — one module means the next rename touches exactly one line.
// (client-portal keeps its own copies on purpose: the two apps share no
// code by convention.) Status/type no longer have fixed label maps here —
// they're admin-manageable catalogs now, see useTicketStatuses()/
// useTicketTypes().

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
} as Record<TicketPriority, string>;

export const ROLE_LABELS: Record<UserRole, string> = {
  client: 'Клиент',
  operator: 'Оператор',
  admin: 'Администратор',
} as Record<UserRole, string>;

export const PRIORITY_OPTIONS = Object.keys(PRIORITY_LABELS) as TicketPriority[];
