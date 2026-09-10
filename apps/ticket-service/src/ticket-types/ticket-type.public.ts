import { TicketTypeEntity } from '@veloxdesk/database';
import type { PublicTicketType } from '@veloxdesk/types';

export function toPublicTicketType(type: TicketTypeEntity): PublicTicketType {
  return {
    id: type.id,
    key: type.key ?? null,
    name: type.name,
    nameUk: type.nameUk ?? null,
    nameEn: type.nameEn ?? null,
    color: type.color,
    isDefault: type.isDefault,
    weight: type.weight,
    sortOrder: type.sortOrder,
  };
}
