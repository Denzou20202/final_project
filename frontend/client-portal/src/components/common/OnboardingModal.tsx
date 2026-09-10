import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCompleteProfile } from '../../hooks/useAuth.js';
import { useCities } from '../../hooks/useCities.js';
import { useCompanies } from '../../hooks/useCompanies.js';
import { getErrorMessage } from '../../lib/errors.js';
import { LETTERS_ONLY_REGEX, PHONE_REGEX, capitalizeFirst, formatUaPhone } from '../../lib/textValidation.js';

type FormValues = {
  position: string;
  department: string;
  company: string;
  city: string;
  phone: string;
  computerName: string;
};

// Mandatory client-onboarding modal — shown once, right after registration,
// until UsersService.completeProfile has run (gated in AppLayout.tsx on
// me.profileCompletedAt). Deliberately has NO way to close it: no X button,
// no Escape handler, no backdrop click — same 85vh/85vw shell as
// operator-app's PendingRegistrationsModal, minus every dismiss affordance.
export function OnboardingModal() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'welcome' | 'form'>('welcome');
  const completeProfile = useCompleteProfile();
  const { data: companies } = useCompanies();
  const { data: cities } = useCities();

  const schema = useMemo(
    () =>
      z.object({
        position: z
          .string()
          .min(1, t('onboarding.fieldRequired'))
          .regex(LETTERS_ONLY_REGEX, t('onboarding.lettersOnlyError')),
        department: z
          .string()
          .min(1, t('onboarding.fieldRequired'))
          .regex(LETTERS_ONLY_REGEX, t('onboarding.lettersOnlyError')),
        company: z.string().min(1, t('onboarding.fieldRequired')),
        city: z.string().min(1, t('onboarding.fieldRequired')),
        phone: z.string().min(1, t('onboarding.fieldRequired')).regex(PHONE_REGEX, t('onboarding.phoneFormatError')),
        computerName: z.string(),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { position: '', department: '', company: '', city: '', phone: '', computerName: '' },
  });

  // Standard RHF trick for a live-transform input: mutate the DOM value
  // before handing the event to RHF's own onChange, so what gets registered
  // (and what the field visibly shows) is already uppercase, not just what
  // gets submitted at the end.
  const { onChange: onComputerNameChange, ...computerNameField } = register('computerName');
  const { onChange: onPositionChange, ...positionField } = register('position');
  const { onChange: onDepartmentChange, ...departmentField } = register('department');
  const { onChange: onPhoneChange, ...phoneField } = register('phone');

  const onSubmit = (values: FormValues) => {
    completeProfile.mutate({
      position: values.position,
      department: values.department,
      company: values.company,
      city: values.city,
      phone: values.phone,
      computerName: values.computerName || undefined,
    });
  };

  const errorMessage = completeProfile.error ? getErrorMessage(completeProfile.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-lg sm:h-[85vh] sm:w-[85vw] sm:rounded-2xl sm:border sm:border-border">
        {step === 'welcome' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="font-display text-2xl font-bold">{t('onboarding.welcomeTitle')}</div>
            <p className="max-w-md text-[14px] text-ink-muted">{t('onboarding.welcomeText')}</p>
            <button
              type="button"
              onClick={() => setStep('form')}
              className="mt-2 rounded-lg bg-brand-600 px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-brand-hover"
            >
              {t('onboarding.next')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-none border-b border-border px-6 py-4">
              <div className="font-display text-base font-bold">{t('onboarding.formTitle')}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('onboarding.formSubtitle')}</div>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 flex-1 overflow-y-auto px-6 py-5" noValidate>
              <div className="mx-auto flex max-w-lg flex-col gap-4">
                <div>
                  <label htmlFor="position" className="mb-1 block text-[13.5px] font-medium text-ink-muted">
                    {t('onboarding.positionLabel')}
                  </label>
                  <input
                    id="position"
                    className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                    {...positionField}
                    onChange={(e) => {
                      e.target.value = capitalizeFirst(e.target.value);
                      onPositionChange(e);
                    }}
                  />
                  {errors.position && <p className="mt-1 text-xs text-priority-urgent">{errors.position.message}</p>}
                </div>

                <div>
                  <label htmlFor="department" className="mb-1 block text-[13.5px] font-medium text-ink-muted">
                    {t('onboarding.departmentLabel')}
                  </label>
                  <input
                    id="department"
                    className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                    {...departmentField}
                    onChange={(e) => {
                      e.target.value = capitalizeFirst(e.target.value);
                      onDepartmentChange(e);
                    }}
                  />
                  {errors.department && (
                    <p className="mt-1 text-xs text-priority-urgent">{errors.department.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="company" className="mb-1 block text-[13.5px] font-medium text-ink-muted">
                      {t('onboarding.companyLabel')}
                    </label>
                    <select
                      id="company"
                      className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                      defaultValue=""
                      {...register('company')}
                    >
                      <option value="" disabled>
                        {t('onboarding.selectPlaceholder')}
                      </option>
                      {(companies ?? []).map((company) => (
                        <option key={company.id} value={company.name}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    {errors.company && <p className="mt-1 text-xs text-priority-urgent">{errors.company.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="city" className="mb-1 block text-[13.5px] font-medium text-ink-muted">
                      {t('onboarding.cityLabel')}
                    </label>
                    <select
                      id="city"
                      className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                      defaultValue=""
                      {...register('city')}
                    >
                      <option value="" disabled>
                        {t('onboarding.selectPlaceholder')}
                      </option>
                      {(cities ?? []).map((city) => (
                        <option key={city.id} value={city.name}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                    {errors.city && <p className="mt-1 text-xs text-priority-urgent">{errors.city.message}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="mb-1 block text-[13.5px] font-medium text-ink-muted">
                    {t('onboarding.phoneLabel')}
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+380 00 000-00-00"
                    className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                    {...phoneField}
                    onChange={(e) => {
                      e.target.value = formatUaPhone(e.target.value);
                      onPhoneChange(e);
                    }}
                  />
                  {errors.phone && <p className="mt-1 text-xs text-priority-urgent">{errors.phone.message}</p>}
                </div>

                <div>
                  <label htmlFor="computerName" className="mb-1 block text-[13.5px] font-medium text-ink-muted">
                    {t('onboarding.computerNameLabel')}
                  </label>
                  <input
                    id="computerName"
                    className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                    {...computerNameField}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      onComputerNameChange(e);
                    }}
                  />
                  <p className="mt-1 text-[11.5px] text-ink-faint">{t('onboarding.computerNameHint')}</p>
                </div>

                {errorMessage && (
                  <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={completeProfile.isPending}
                  className="mt-1 self-end rounded-lg bg-brand-600 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
                >
                  {completeProfile.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
