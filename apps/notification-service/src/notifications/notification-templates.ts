import { Locale, NotificationType } from '@veloxdesk/types';

export interface NotificationTemplateData {
  recipientName: string;
  ticketTitle: string;
  // The status's display name resolved by the caller (notifications.processor.ts)
  // — replaces the old hardcoded STATUS_LABELS map, which couldn't express an
  // admin-created custom status.
  ticketStatusName: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
}

// Keyed by Locale so an email lands in whichever language is set on the
// recipient's UserEntity.locale — every other real-time surface (web UI,
// libs/common/telegram/bot-strings.ts's outbound Telegram messages) already
// respects it; email was the one channel still hardcoded to Russian
// regardless of the recipient's own setting.
type LocalizedTemplates = Record<NotificationType, (data: NotificationTemplateData) => RenderedEmail>;

const TEMPLATES: Record<Locale, LocalizedTemplates> = {
  [Locale.RU]: {
    [NotificationType.ASSIGNMENT]: (data) => ({
      subject: `Вам назначен тикет: ${data.ticketTitle}`,
      text: `Здравствуйте, ${data.recipientName}!\n\nВам назначен тикет «${data.ticketTitle}».`,
    }),
    [NotificationType.REPLY]: (data) => ({
      subject: `Новый ответ в тикете: ${data.ticketTitle}`,
      text: `Здравствуйте, ${data.recipientName}!\n\nПоступил новый ответ в тикете «${data.ticketTitle}».`,
    }),
    [NotificationType.NEW_TICKET]: (data) => ({
      subject: `Новый тикет: ${data.ticketTitle}`,
      text: `Здравствуйте, ${data.recipientName}!\n\nСоздан новый тикет «${data.ticketTitle}».`,
    }),
    [NotificationType.SLA_BREACH]: (data) => ({
      subject: `Нарушение SLA: ${data.ticketTitle}`,
      text: `Здравствуйте, ${data.recipientName}!\n\nПо тикету «${data.ticketTitle}» нарушен SLA.`,
    }),
    [NotificationType.STATUS_UPDATE]: (data) => ({
      subject: `Статус тикета изменился: ${data.ticketTitle}`,
      text: `Здравствуйте, ${data.recipientName}!\n\nТекущий статус вашего тикета «${data.ticketTitle}»: ${data.ticketStatusName}.`,
    }),
    [NotificationType.MENTION]: (data) => ({
      subject: `Вас упомянули в тикете: ${data.ticketTitle}`,
      text: `Здравствуйте, ${data.recipientName}!\n\nВас упомянули в тикете «${data.ticketTitle}».`,
    }),
  },
  [Locale.UK]: {
    [NotificationType.ASSIGNMENT]: (data) => ({
      subject: `Вам призначено тікет: ${data.ticketTitle}`,
      text: `Вітаємо, ${data.recipientName}!\n\nВам призначено тікет «${data.ticketTitle}».`,
    }),
    [NotificationType.REPLY]: (data) => ({
      subject: `Нова відповідь у тікеті: ${data.ticketTitle}`,
      text: `Вітаємо, ${data.recipientName}!\n\nНадійшла нова відповідь у тікеті «${data.ticketTitle}».`,
    }),
    [NotificationType.NEW_TICKET]: (data) => ({
      subject: `Новий тікет: ${data.ticketTitle}`,
      text: `Вітаємо, ${data.recipientName}!\n\nСтворено новий тікет «${data.ticketTitle}».`,
    }),
    [NotificationType.SLA_BREACH]: (data) => ({
      subject: `Порушення SLA: ${data.ticketTitle}`,
      text: `Вітаємо, ${data.recipientName}!\n\nУ тікеті «${data.ticketTitle}» порушено SLA.`,
    }),
    [NotificationType.STATUS_UPDATE]: (data) => ({
      subject: `Статус тікета змінився: ${data.ticketTitle}`,
      text: `Вітаємо, ${data.recipientName}!\n\nПоточний статус вашого тікета «${data.ticketTitle}»: ${data.ticketStatusName}.`,
    }),
    [NotificationType.MENTION]: (data) => ({
      subject: `Вас згадали у тікеті: ${data.ticketTitle}`,
      text: `Вітаємо, ${data.recipientName}!\n\nВас згадали у тікеті «${data.ticketTitle}».`,
    }),
  },
  [Locale.EN]: {
    [NotificationType.ASSIGNMENT]: (data) => ({
      subject: `Ticket assigned to you: ${data.ticketTitle}`,
      text: `Hi ${data.recipientName},\n\nTicket "${data.ticketTitle}" has been assigned to you.`,
    }),
    [NotificationType.REPLY]: (data) => ({
      subject: `New reply on ticket: ${data.ticketTitle}`,
      text: `Hi ${data.recipientName},\n\nThere's a new reply on ticket "${data.ticketTitle}".`,
    }),
    [NotificationType.NEW_TICKET]: (data) => ({
      subject: `New ticket: ${data.ticketTitle}`,
      text: `Hi ${data.recipientName},\n\nA new ticket "${data.ticketTitle}" has been created.`,
    }),
    [NotificationType.SLA_BREACH]: (data) => ({
      subject: `SLA breach: ${data.ticketTitle}`,
      text: `Hi ${data.recipientName},\n\nTicket "${data.ticketTitle}" has breached its SLA.`,
    }),
    [NotificationType.STATUS_UPDATE]: (data) => ({
      subject: `Ticket status changed: ${data.ticketTitle}`,
      text: `Hi ${data.recipientName},\n\nThe current status of your ticket "${data.ticketTitle}" is: ${data.ticketStatusName}.`,
    }),
    [NotificationType.MENTION]: (data) => ({
      subject: `You were mentioned in a ticket: ${data.ticketTitle}`,
      text: `Hi ${data.recipientName},\n\nYou were mentioned in ticket "${data.ticketTitle}".`,
    }),
  },
};

export function renderNotificationEmail(
  type: NotificationType,
  data: NotificationTemplateData,
  locale: Locale,
): RenderedEmail {
  return TEMPLATES[locale][type](data);
}
