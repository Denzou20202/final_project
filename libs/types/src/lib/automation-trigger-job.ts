import { AutomationTrigger } from './enums.js';

// Shared BullMQ contract for the Dispatcher (automation rules). Producers:
// ticket-service (ticket_created/status_changed/priority_changed/sla_breached
// — same process as the consumer, but routed through the queue anyway for a
// uniform, retried, non-blocking apply) and chat-service (client_replied —
// a genuinely different process, this is the only way it can reach the rule
// engine that lives in ticket-service). Consumer: ticket-service.
export const AUTOMATION_TRIGGER_QUEUE_NAME = 'automation-triggers';

export interface AutomationTriggerJobPayload {
  trigger: AutomationTrigger;
  ticketId: string;
}
