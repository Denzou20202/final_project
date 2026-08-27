import { MacroEntity } from '@veloxdesk/database';

export interface PublicMacro {
  id: string;
  title: string;
  titleUk: string | null;
  titleEn: string | null;
  body: string;
  createdAt: Date;
}

export function toPublicMacro(macro: MacroEntity): PublicMacro {
  return {
    id: macro.id,
    title: macro.title,
    titleUk: macro.titleUk ?? null,
    titleEn: macro.titleEn ?? null,
    body: macro.body,
    createdAt: macro.createdAt,
  };
}
