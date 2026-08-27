import { motion } from 'framer-motion';
import { zodResolver } from '@hookform/resolvers/zod';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import type { PublicUser } from '../../lib/types.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { useCreateTicket } from '../../hooks/useTickets.js';
import { useTicketCategories } from '../../hooks/useTicketCategories.js';
import { pickLocalized } from '../../lib/localized.js';
import { RichTextEditor } from '../chat/RichTextEditor.js';
import { VipBadge } from '../common/VipBadge.js';

type FormValues = { clientId: string; title: string; categoryId: string };

// Type-ahead: no separate dropdown-select step, no debounce — the client
// list is already fully loaded (useAssignableUsers), so filtering on every
// keystroke is a synchronous in-memory `.filter()` and the match list
// updates in the same render as the keypress.
function ClientPicker({
  clients,
  value,
  onChange,
}: {
  clients: PublicUser[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const selected = clients.find((c) => c.id === value) ?? null;
  const [query, setQuery] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) =>
      [c.fullName, c.email, c.phone, c.city].some((field) => field?.toLowerCase().includes(term)),
    );
  }, [clients, query]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function selectClient(client: PublicUser) {
    onChange(client.id);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const client = matches[highlighted];
      if (client) selectClient(client);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          {selected.fullName} <span className="text-ink-faint">· {selected.email}</span>
          {selected.isVip && <VipBadge />}
        </span>
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('ticketModals.changeClientAria')}
          className="flex-none text-ink-faint hover:text-priority-urgent"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        placeholder={t('ticketModals.searchClientPlaceholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
      />
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-card py-1 shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-[12.5px] text-ink-faint">{t('ticketModals.noClientsFound')}</div>
          ) : (
            matches.map((c, index) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectClient(c)}
                className={`block w-full truncate px-3 py-1.5 text-left text-[13px] ${
                  index === highlighted ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                }`}
              >
                <span className="font-medium">{c.fullName}</span>
                {c.isVip && <VipBadge className="ml-1.5 align-middle" />}
                <span className="text-ink-faint">
                  {' '}
                  · {c.email}
                  {c.phone ? ` · ${c.phone}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// This modal is only ever opened from operator-app, i.e. by an operator or
// admin — clients create their own tickets through client-portal's separate
// NewTicketPage. So staff here are always logging a ticket on someone
// else's behalf (typically a phone call): picking the client is mandatory,
// not an optional extra, so the ticket ends up owned by the right person
// and the «Клиент» panel on the created ticket shows their profile.
export function CreateTicketModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  // Rebuilt on language change so validation messages follow the active
  // locale — a module-level schema would freeze at whatever language was
  // active on first import. `description` isn't in here — see the editor
  // block below for why it's validated separately, same as
  // KnowledgeEditorPage's article body.
  const schema = useMemo(
    () =>
      z.object({
        clientId: z.string().min(1, t('ticketModals.clientRequired')),
        title: z.string().min(3, t('ticketModals.titleMinLength')),
        categoryId: z.string(),
      }),
    [t],
  );
  const createTicket = useCreateTicket();
  const navigate = useNavigate();
  const { data: usersPage } = useAssignableUsers();
  const { data: categories } = useTicketCategories();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { clientId: '', categoryId: '' } });
  const clientId = watch('clientId');

  const clients = useMemo(() => (usersPage?.items ?? []).filter((u) => u.role === 'client' && !u.deactivatedAt), [
    usersPage,
  ]);

  // `description` is pulled out of react-hook-form entirely — a Tiptap
  // editor's content isn't a controllable form field the way a plain
  // <textarea> is, so it's tracked (and validated) directly off the editor
  // instance instead, same pattern as KnowledgeEditorPage's article body.
  // Mount-time-only seed for the placeholder text — Tiptap doesn't react to
  // a changed `extensions` array on an already-mounted editor. TableKit
  // config mirrors KnowledgeEditorPage's own (resizing disabled — see that
  // page's comment on why). No Mention here (unlike ChatPanel) — there's no
  // conversation yet to mention anyone into.
  const descriptionExtensions = useMemo(
    () => [
      StarterKit.configure({ heading: false, horizontalRule: false, codeBlock: false, strike: false }),
      Placeholder.configure({ placeholder: t('ticketModals.descriptionLabel') }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [descriptionError, setDescriptionError] = useState<string | undefined>(undefined);
  const descriptionEditor = useEditor({
    extensions: descriptionExtensions,
    content: '',
    onUpdate: () => setDescriptionError(undefined),
  });

  const onSubmit = (values: FormValues) => {
    if (!descriptionEditor || descriptionEditor.isEmpty) {
      setDescriptionError(t('ticketModals.descriptionRequired'));
      return;
    }
    createTicket.mutate(
      {
        title: values.title,
        description: descriptionEditor.getHTML(),
        onBehalfOf: values.clientId,
        categoryId: values.categoryId || undefined,
      },
      {
        onSuccess: (ticket) => {
          onClose();
          navigate(`/tickets/${ticket.id}`);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', bounce: 0.35, duration: 0.4 }}
        className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border"
      >
        <h2 className="mb-4 font-display text-base font-bold">{t('ticketModals.newTicketTitle')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">{t('ticketDetail.client')}</label>
            <ClientPicker
              clients={clients}
              value={clientId}
              onChange={(id) => setValue('clientId', id, { shouldValidate: true })}
            />
            {errors.clientId && <p className="mt-1 text-xs text-priority-urgent">{errors.clientId.message}</p>}
          </div>

          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('tickets.columnTitle')}
            </label>
            <input
              id="title"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('title')}
            />
            {errors.title && <p className="mt-1 text-xs text-priority-urgent">{errors.title.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">
              {t('ticketModals.descriptionLabel')}
            </label>
            <RichTextEditor editor={descriptionEditor} minHeight="6rem" maxHeight="16rem" showTable />
            {descriptionError && <p className="mt-1 text-xs text-priority-urgent">{descriptionError}</p>}
          </div>

          <div>
            <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('ticketFields.category')}
            </label>
            <select
              id="categoryId"
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('categoryId')}
            >
              <option value="">{t('ticketFields.noCategory')}</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {pickLocalized(category.name, category.nameUk, category.nameEn, i18n.language)}
                </option>
              ))}
            </select>
          </div>

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
              disabled={createTicket.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {createTicket.isPending ? t('ticketModals.creating') : t('ticketModals.create')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
