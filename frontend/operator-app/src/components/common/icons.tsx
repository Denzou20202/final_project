// Real vector icons, not emoji/dingbat characters (☀ ⚙ 🌙) — those render
// with wildly inconsistent size and visual weight across fonts/OSes (a
// colorful emoji-style sun next to a thin monochrome gear at the same
// font-size looks mismatched, not like a matching icon pair). currentColor
// means they pick up the same hover/muted text-color classes text did.

export function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.25M12 18.75V21M18.36 5.64l-1.59 1.59M7.23 16.77l-1.59 1.59M21 12h-2.25M5.25 12H3M18.36 18.36l-1.59-1.59M7.23 7.23 5.64 5.64" />
    </svg>
  );
}

export function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21.75 15.002a9.72 9.72 0 0 1-3.752.748c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.598.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9-5.998Z" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Icon-rail category glyphs — Знания / Дашборд / Отчёты.
export function BookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 6.5c-1.5-1-3.5-1.5-5.5-1.5-1 0-2 .1-3 .4v12.5c1-.3 2-.4 3-.4 2 0 4 .5 5.5 1.5" />
      <path d="M12 6.5c1.5-1 3.5-1.5 5.5-1.5 1 0 2 .1 3 .4v12.5c-1-.3-2-.4-3-.4-2 0-4 .5-5.5 1.5" />
      <path d="M12 6.5v12.5" />
    </svg>
  );
}

export function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className={className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.2" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.2" />
      <rect x="3.5" y="13" width="7" height="7.5" rx="1.2" />
    </svg>
  );
}

// Mobile-only hamburger — opens the IconRail+Sidebar drawer (see
// AppLayout) on screens too narrow to show it alongside <main>.
export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ReportIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 3.5h9l4 4V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14.5 3.5V7a1 1 0 0 0 1 1H19" />
      <path d="M8 12.5h8M8 15.5h8M8 9.5h3" />
    </svg>
  );
}

// Reports hub section glyphs — Динамика / Аудит / Экспорт заявок.
export function TrendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 18V6M4 18h16" />
      <path d="M6.5 14.5 10 11l3 3 5-6" />
      <path d="M15 8h3v3" />
    </svg>
  );
}

export function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5.5" y="4.5" width="13" height="16" rx="1.5" />
      <path d="M9 4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4.5V6H9V4.5Z" />
      <path d="m8.5 13 2 2 4-4" />
      <path d="M8.5 17.5h7" />
    </svg>
  );
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 4v11" />
      <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
      <path d="M5 18.5h14v1.5H5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Reports hub — «Оценка CSAT».
export function SmileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </svg>
  );
}

// Reports hub — «Отчёт по операторам».
export function HeadsetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4.5 13v-1a7.5 7.5 0 0 1 15 0v1" />
      <rect x="3.5" y="12.5" width="3.5" height="5" rx="1.2" />
      <rect x="17" y="12.5" width="3.5" height="5" rx="1.2" />
      <path d="M17 17.5v.5a3 3 0 0 1-3 3h-2" />
    </svg>
  );
}

// Ticket list header — «Сохранённые фильтры».
export function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6.5 4.5h11a1 1 0 0 1 1 1V20l-6.5-4-6.5 4V5.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

// IconRail — «Заявки на регистрацию» (admin-only pending-registrations bell).
export function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 10a6 6 0 1 1 12 0c0 3.2 1 4.8 1.8 5.7.4.4.1 1.1-.5 1.1H4.7c-.6 0-.9-.7-.5-1.1C5 14.8 6 13.2 6 10Z" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

// IconRail — «Метки» (moved here from the wide Sidebar).
export function TagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11.5 3.5H6a1 1 0 0 0-1 1v5.5a1 1 0 0 0 .3.7l9 9a1 1 0 0 0 1.4 0l6.5-6.5a1 1 0 0 0 0-1.4l-9-9a1 1 0 0 0-.7-.3Z" />
      <circle cx="9" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

// TicketActionsPanel — «Создано из» (channel badge). Classic paper-plane
// send glyph, not Telegram's actual brand mark — stays consistent with
// every other icon here being a plain outline, not a colored logo.
export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

// TicketActionsPanel — «Создано из» (channel badge), the portal/web-app case.
export function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.3 3.8 5.4 3.8 8.5s-1.4 6.2-3.8 8.5c-2.4-2.3-3.8-5.4-3.8-8.5s1.4-6.2 3.8-8.5Z" />
    </svg>
  );
}

// TicketActionsPanel — «Создано из», the email-ingestion case.
export function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="m4 6.5 8 6.5 8-6.5" />
    </svg>
  );
}
