import type { UserRole } from '../../lib/types.js';
import { useTranslation } from 'react-i18next';

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  client: 'bg-status-new/15 text-status-new',
  operator: 'bg-brand-600/15 text-brand-700',
  admin: 'bg-priority-high/15 text-priority-high',
} as Record<UserRole, string>;

export function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation();
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ROLE_BADGE_CLASSES[role]}`}>
      {t(`userRole.${role}`)}
    </span>
  );
}
