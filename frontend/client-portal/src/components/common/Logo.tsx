import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LogoMark } from './LogoMark.js';

export function Logo() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate('/tickets')}
      aria-label={`VeloxDesk — ${t('sidebar.allTickets')}`}
      className="rounded-lg transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <LogoMark size={36} />
    </button>
  );
}
