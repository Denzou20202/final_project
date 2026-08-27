import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useTeams } from '../../hooks/useTeams.js';
import { useCreateTicket } from '../../hooks/useTickets.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { assignTicket, assignTicketTeam } from '../../lib/api/tickets.api.js';
import { getErrorMessage } from '../../lib/errors.js';
import { htmlToPlainText } from '../../lib/html.js';
import { pickLocalized } from '../../lib/localized.js';
import { isAssignableStaff } from '../../lib/staff.js';

type FormValues = { title: string; description: string; assigneeId: string; teamId: string };

// comment.body is sanitized HTML (see MessageBubble) — the new ticket's
// Описание is a plain textarea, so strip tags down to the text a person
// actually typed.

// Opened from a button under a client's chat message — the client may have
// raised an unrelated second issue in the same thread, and this spins it off
// into its own ticket instead of tangling two topics together. The new
// ticket is created on behalf of the SAME client (already known from this
// thread, no picker needed) with the message text pre-filled as the
// description.
export function SplitToTicketModal({
  clientId,
  sourceBody,
  onClose,
}: {
  clientId: string;
  sourceBody: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  // Rebuilt on language change so validation messages follow the active
  // locale — a module-level schema would freeze at whatever language was
  // active on first import.
  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(3, t('ticketModals.titleMinLength')),
        description: z.string().min(1, t('ticketModals.descriptionRequired')),
        assigneeId: z.string(),
        teamId: z.string(),
      }),
    [t],
  );
  const createTicket = useCreateTicket();
  const { data: usersPage } = useAssignableUsers();
  const { data: teams } = useTeams();
  const navigate = useNavigate();
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: htmlToPlainText(sourceBody), assigneeId: '', teamId: '' },
  });

  const staff = (usersPage?.items ?? []).filter(isAssignableStaff);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const ticket = await createTicket.mutateAsync({
        title: values.title,
        description: values.description,
        onBehalfOf: clientId,
      });
      // Best-effort: the ticket itself is already created at this point —
      // an assignment hiccup shouldn't block navigating to it, the operator
      // can always set исполнитель/отдел by hand from there.
      if (values.assigneeId) {
        await assignTicket(ticket.id, values.assigneeId).catch(() => undefined);
      }
      if (values.teamId) {
        await assignTicketTeam(ticket.id, values.teamId).catch(() => undefined);
      }
      onClose();
      navigate(`/tickets/${ticket.id}`);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-1 font-display text-base font-bold">{t('ticketModals.splitTitle')}</h2>
        <p className="mb-4 text-[12.5px] text-ink-subtle">{t('ticketModals.splitSubtitle')}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="split-title" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('tickets.columnTitle')}
            </label>
            <input
              id="split-title"
              autoFocus
              placeholder={t('ticketModals.topicPlaceholder')}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('title')}
            />
            {errors.title && <p className="mt-1 text-xs text-priority-urgent">{errors.title.message}</p>}
          </div>

          <div>
            <label htmlFor="split-description" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('ticketModals.descriptionLabel')}
            </label>
            <textarea
              id="split-description"
              rows={5}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('description')}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-priority-urgent">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="split-assignee" className="mb-1 block text-sm font-medium text-ink-muted">
                {t('ticketFields.assignee')}
              </label>
              <select
                id="split-assignee"
                className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-2 text-sm outline-none focus:border-brand-600"
                {...register('assigneeId')}
              >
                <option value="">{t('ticketFields.notAssigned')}</option>
                {staff.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="split-team" className="mb-1 block text-sm font-medium text-ink-muted">
                {t('ticketFields.team')}
              </label>
              <select
                id="split-team"
                className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-2 text-sm outline-none focus:border-brand-600"
                {...register('teamId')}
              >
                <option value="">{t('ticketFields.notAssigned')}</option>
                {(teams ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {submitError && <p className="text-xs text-priority-urgent">{submitError}</p>}

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
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {isSubmitting ? t('ticketModals.creating') : t('ticketModals.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
