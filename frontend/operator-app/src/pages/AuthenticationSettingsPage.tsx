import { AuthAudience } from '@veloxdesk/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LdapConfigCard } from '../components/settings/LdapConfigCard.js';
import { OidcConfigCard } from '../components/settings/OidcConfigCard.js';

// Admin-only (gated by SettingsModal's adminOnly flag on this section, same
// as every other admin-config page). Two audiences (staff/client) × two
// protocols (LDAP/OIDC) — see LdapConfigEntity/OidcConfigEntity's own
// comments for why this is per-audience rather than a single global config.
export default function AuthenticationSettingsPage() {
  const { t } = useTranslation();
  const [audience, setAudience] = useState<AuthAudience>(AuthAudience.STAFF);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none px-4 pb-3.5 pt-4 sm:px-6">
        <div className="font-display text-lg font-bold">{t('admin.auth.title')}</div>
        <p className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.auth.subtitle')}</p>

        <div className="mt-3 flex gap-1 rounded-lg border border-border bg-surface p-1">
          {[AuthAudience.STAFF, AuthAudience.CLIENT].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAudience(option)}
              className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                audience === option ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-surface-muted'
              }`}
            >
              {option === AuthAudience.STAFF ? t('admin.auth.audienceStaff') : t('admin.auth.audienceClient')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        <div className="mb-3 rounded-lg bg-surface-muted px-3 py-2 text-[12.5px] text-ink-subtle">
          {t('admin.auth.enableWarning')}
        </div>
        <div className="flex flex-col gap-4">
          <LdapConfigCard audience={audience} />
          <OidcConfigCard audience={audience} />
        </div>
      </div>
    </div>
  );
}
