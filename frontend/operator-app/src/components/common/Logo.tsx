import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Logo() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate('/tickets')}
      aria-label={`VeloxDesk — ${t('sidebar.allTickets')}`}
      className="flex-none rounded-lg text-left transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -18 550 138" className="h-[44px] w-auto text-ink">
        <defs>
          <mask id="ticket-cutouts">
            <rect x="-50" y="-50" width="400" height="200" fill="white" />
            <circle cx="108.5" cy="43" r="4.5" fill="black" />
            <circle cx="108.5" cy="100" r="4.5" fill="black" />
            <rect x="103" y="54" width="3" height="35" rx="1.5" fill="black" />
            <rect x="111" y="54" width="3" height="35" rx="1.5" fill="black" />
          </mask>
        </defs>
        
        <g fill="#FF5500">
          {/* V */}
          <path d="M 0 42 L 22 42 L 48 85 L 83 -12 L 105 -12 L 60 100 L 32 100 Z" />
          
          {/* Ticket with notches & slits (narrower) */}
          <path mask="url(#ticket-cutouts)" d="M 99.8 43 L 126 43 L 126 100 L 91 100 L 91 65 Z" />
          
          {/* D arch (top bar goes above ticket, bottom bar stops before ticket) */}
          <path d="M 110.6 16 L 145 16 A 42 42 0 0 1 145 100 L 138 100 L 138 80 L 145 80 A 22 22 0 0 0 145 36 L 102.6 36 Z" />
        </g>
        
        <text x="210" y="74" fontFamily="'Exo 2', sans-serif" fontWeight="bold" fontSize="68" fill="currentColor" letterSpacing="-1">VeloxDesk</text>
        <text x="530" y="100" fontFamily="'Exo 2', sans-serif" fontStyle="italic" fontWeight="600" fontSize="34" fill="currentColor" textAnchor="end" letterSpacing="-0.5">Support</text>
      </svg>
    </button>
  );
}
