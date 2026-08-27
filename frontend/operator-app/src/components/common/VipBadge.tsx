import { useTranslation } from 'react-i18next';

// Golden crown badge for VIP clients (see UserEntity.isVip, toggled in
// EditUserModal/CreateUserModal). SVG glyph rather than the earlier
// text-in-shape approach — the title/aria-label already carries the "VIP"
// wording for a11y, so the icon itself can just be the universally
// recognizable crown silhouette.
export function VipBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      title={t('common.vipBadgeAria')}
      aria-label={t('common.vipBadgeAria')}
      className={`inline-flex flex-none items-center justify-center ${className}`}
      style={{ width: '1em', height: '1em' }}
    >
      {/* viewBox cropped to the crown's own bounding box (y 32-384) — the
          original glyph also included a base band below the crown that we
          deliberately drop, so the crop keeps the remaining shape filling
          the badge instead of floating in the upper portion with dead
          space underneath. */}
      <svg viewBox="0 32 576 352" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="#fbbf24"
          stroke="#b45309"
          strokeWidth="16"
          strokeLinejoin="round"
          d="M528 32c-26.5 0-48 21.5-48 48c0 7.1 1.6 13.7 4.4 19.8L416 160l-72.1-93.7c9.3-8.8 15.1-21.1 15.1-34.8c0-26.5-21.5-48-48-48s-48 21.5-48 48c0 13.8 5.8 26.1 15.1 34.8L190 160l-68.4-60.2c2.8-6.1 4.4-12.7 4.4-19.8c0-26.5-21.5-48-48-48S30 53.5 30 80s21.5 48 48 48c2.6 0 5.2-.2 7.7-.6L128 384h320l42.3-256.6c2.5 .4 5.1 .6 7.7 .6c26.5 0 48-21.5 48-48s-21.5-48-48-48z"
        />
      </svg>
    </span>
  );
}
