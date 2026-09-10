import { useTranslation } from 'react-i18next';
import { useThemeStore, DesignTheme } from '../../store/theme.store.js';

export function DesignTab() {
  const { t } = useTranslation();
  const { designTheme, setDesignTheme } = useThemeStore();

  const themes: { key: DesignTheme; name: string; description: string; colors: string[] }[] = [
    {
      key: 'contrast',
      name: 'Absolute Contrast',
      description: t('settings.designThemeContrastDescription'),
      colors: ['bg-white', 'bg-black', 'bg-[#8B5CF6]'],
    },
    {
      key: 'warm',
      name: 'Modern Warmth',
      description: t('settings.designThemeWarmDescription'),
      colors: ['bg-[#FCFCF9]', 'bg-[#1C1917]', 'bg-[#E06A50]'],
    },
    {
      key: 'cyber',
      name: 'Cyber Glass',
      description: t('settings.designThemeCyberDescription'),
      colors: ['bg-[#F0F5FF]', 'bg-[#0B0F19]', 'bg-[#0EA5E9]'],
    },
    {
      key: 'forest',
      name: 'Zen Forest',
      description: t('settings.designThemeForestDescription'),
      colors: ['bg-[#F6F8F6]', 'bg-[#101A15]', 'bg-[#10B981]'],
    },
    {
      key: 'sunset',
      name: 'Sunset Glow',
      description: t('settings.designThemeSunsetDescription'),
      colors: ['bg-[#FFF9F5]', 'bg-[#180F1C]', 'bg-[#F43F5E]'],
    },
    {
      key: 'slate',
      name: 'Industrial Slate',
      description: t('settings.designThemeSlateDescription'),
      colors: ['bg-[#F1F5F9]', 'bg-[#1E293B]', 'bg-[#2563EB]'],
    },
    {
      key: 'classic',
      name: 'Original Classic',
      description: t('settings.designThemeClassicDescription'),
      colors: ['bg-[#F4EFE8]', 'bg-[#151A21]', 'bg-[#0D9488]'],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t('settings.designTheme')}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t('settings.designThemeDescription')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => {
          const isActive = designTheme === theme.key;
          return (
            <button
              key={theme.key}
              onClick={() => setDesignTheme(theme.key)}
              className={`relative flex cursor-pointer flex-col overflow-hidden rounded-xl border p-4 text-left transition-all ${
                isActive
                  ? 'border-brand-600 bg-brand-50 shadow-md ring-1 ring-brand-600'
                  : 'border-border bg-surface-card hover:border-brand-300 hover:shadow-sm'
              }`}
            >
              <div className="mb-3 flex items-center gap-2">
                {theme.colors.map((color, i) => (
                  <div key={i} className={`h-4 w-4 rounded-full border border-black/10 ${color}`} />
                ))}
              </div>
              <div className="text-[13.5px] font-semibold text-ink">{theme.name}</div>
              <div className="mt-1 text-[11.5px] text-ink-muted leading-tight">{theme.description}</div>
              {isActive && (
                <div className="absolute right-3 top-3 text-brand-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
