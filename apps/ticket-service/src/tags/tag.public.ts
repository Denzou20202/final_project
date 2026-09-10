import { TagEntity } from '@veloxdesk/database';

export interface PublicTag {
  id: string;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  createdAt: Date;
}

export function toPublicTag(tag: TagEntity): PublicTag {
  return {
    id: tag.id,
    name: tag.name,
    nameUk: tag.nameUk ?? null,
    nameEn: tag.nameEn ?? null,
    createdAt: tag.createdAt,
  };
}
