import { TicketCategoryEntity } from '@veloxdesk/database';

export interface PublicTicketCategory {
  id: string;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  createdAt: Date;
}

export function toPublicTicketCategory(category: TicketCategoryEntity): PublicTicketCategory {
  return {
    id: category.id,
    name: category.name,
    nameUk: category.nameUk ?? null,
    nameEn: category.nameEn ?? null,
    createdAt: category.createdAt,
  };
}
