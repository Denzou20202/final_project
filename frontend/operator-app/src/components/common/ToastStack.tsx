import { Link } from 'react-router-dom';
import { useTicketNotifications } from '../../hooks/useTicketNotifications.js';

export function ToastStack() {
  const { toasts, dismiss, messageFor } = useTicketNotifications();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Link
          key={toast.id}
          to={`/tickets/${toast.ticketId}`}
          onClick={() => dismiss(toast.id)}
          className="flex w-72 flex-col rounded-xl border border-border bg-elevated px-4 py-3 text-white shadow-lg transition-opacity hover:opacity-95"
        >
          {/* brand-600, not brand-100 — 100 is a fill/tint token, not a text
              color: it's near-white in the light theme (readable, by
              accident) but near-black in the dark theme, invisible against
              bg-elevated there. brand-600 is the app's actual accent teal
              (logo badge, primary buttons) and stays legible against
              `elevated` in both themes. */}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
            {messageFor(toast.type)}
          </span>
          <span className="mt-0.5 truncate text-[13px]">
            #{toast.ticketNumber} · {toast.title}
          </span>
        </Link>
      ))}
    </div>
  );
}
