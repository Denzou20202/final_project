import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCreateCsatQuestion, useUpdateCsatQuestion } from '../../hooks/useCsatQuestions.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicCsatQuestion } from '../../lib/types.js';

type FormValues = { text: string };

export function CsatQuestionModal({
  existing,
  onClose,
}: {
  existing: PublicCsatQuestion | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const schema = useMemo(
    () =>
      z.object({
        text: z.string().min(2, t('admin.csatQuestions.textMinLength')),
      }),
    [t],
  );
  const createQuestion = useCreateCsatQuestion();
  const updateQuestion = useUpdateCsatQuestion();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing ? { text: existing.text } : undefined,
  });

  const onSubmit = (values: FormValues) => {
    if (existing) {
      updateQuestion.mutate({ id: existing.id, ...values }, { onSuccess: onClose });
    } else {
      createQuestion.mutate(values, { onSuccess: onClose });
    }
  };

  const mutation = existing ? updateQuestion : createQuestion;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.csatQuestions.editTitle') : t('admin.csatQuestions.newTitle')}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="text" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.csatQuestions.textLabel')}
            </label>
            <textarea
              id="text"
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('text')}
            />
            {errors.text && <p className="mt-1 text-xs text-priority-urgent">{errors.text.message}</p>}
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
