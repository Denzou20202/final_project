import type { TicketPriority } from '@veloxdesk/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCreateSlaPolicy, useUpdateSlaPolicy } from '../../hooks/useSlaPolicies.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicSlaPolicy } from '../../lib/types.js';

type FormValues = { name: string; responseTimeMin: number; resolutionTimeMin: number };

export function SlaPolicyModal({
  priority,
  existing,
  onClose,
}: {
  priority: TicketPriority;
  existing: PublicSlaPolicy | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Rebuilt on language change so validation messages follow the active
  // locale — a module-level schema would freeze at whatever language was
  // active on first import.
  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().min(3, t('admin.sla.nameMinLength')),
          responseTimeMin: z.number().int().min(1, t('admin.sla.minutesMin')),
          resolutionTimeMin: z.number().int().min(1, t('admin.sla.minutesMin')),
        })
        .refine((values) => values.resolutionTimeMin >= values.responseTimeMin, {
          message: t('admin.sla.resolutionGteResponse'),
          path: ['resolutionTimeMin'],
        }),
    [t],
  );
  const createPolicy = useCreateSlaPolicy();
  const updatePolicy = useUpdateSlaPolicy();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? { name: existing.name, responseTimeMin: existing.responseTimeMin, resolutionTimeMin: existing.resolutionTimeMin }
      : undefined,
  });

  const onSubmit = (values: FormValues) => {
    if (existing) {
      updatePolicy.mutate({ id: existing.id, ...values }, { onSuccess: onClose });
    } else {
      createPolicy.mutate({ ...values, priority }, { onSuccess: onClose });
    }
  };

  const mutation = existing ? updatePolicy : createPolicy;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {t('admin.sla.modalTitle', { priority: t(`ticketPriority.${priority}`) })}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.sla.nameLabel')}
            </label>
            <input
              id="name"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('name')}
            />
            {errors.name && <p className="mt-1 text-xs text-priority-urgent">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="responseTimeMin" className="mb-1 block text-sm font-medium text-ink-muted">
                {t('admin.sla.responseLabel')}
              </label>
              <input
                id="responseTimeMin"
                type="number"
                min={1}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
                {...register('responseTimeMin', { valueAsNumber: true })}
              />
              {errors.responseTimeMin && <p className="mt-1 text-xs text-priority-urgent">{errors.responseTimeMin.message}</p>}
            </div>
            <div>
              <label htmlFor="resolutionTimeMin" className="mb-1 block text-sm font-medium text-ink-muted">
                {t('admin.sla.resolutionLabel')}
              </label>
              <input
                id="resolutionTimeMin"
                type="number"
                min={1}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
                {...register('resolutionTimeMin', { valueAsNumber: true })}
              />
              {errors.resolutionTimeMin && (
                <p className="mt-1 text-xs text-priority-urgent">{errors.resolutionTimeMin.message}</p>
              )}
            </div>
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{errorMessage}</p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
