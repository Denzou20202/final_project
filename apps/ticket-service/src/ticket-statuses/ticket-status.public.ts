import { TicketStatusEntity } from '@veloxdesk/database';
import type { PublicTicketStatus } from '@veloxdesk/types';

export function toPublicTicketStatus(status: TicketStatusEntity): PublicTicketStatus {
  return {
    id: status.id,
    key: status.key ?? null,
    name: status.name,
    nameUk: status.nameUk ?? null,
    nameEn: status.nameEn ?? null,
    color: status.color,
    isDefault: status.isDefault,
    isClosed: status.isClosed,
    tracksSla: status.tracksSla,
    sortOrder: status.sortOrder,
  };
}
