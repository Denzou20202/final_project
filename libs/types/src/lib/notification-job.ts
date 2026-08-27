import { NotificationType } from './enums.js';

// Shared BullMQ contract between producers (ticket-service) and the
// consumer (notification-service) — both must agree on queue name and job
// shape without depending on each other directly.
export const NOTIFICATIONS_QUEUE_NAME = 'notifications';

export interface NotificationJobPayload {
  type: NotificationType;
  userId: string;
  ticketId: string;
}
