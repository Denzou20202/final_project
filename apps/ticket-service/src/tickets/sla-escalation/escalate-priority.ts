import { TicketPriority } from '@veloxdesk/types';

const ESCALATION_ORDER: TicketPriority[] = [
  TicketPriority.LOW,
  TicketPriority.MEDIUM,
  TicketPriority.HIGH,
  TicketPriority.URGENT,
];

// One step up the ladder; already-urgent tickets stay urgent — there's
// nowhere higher to escalate to, but the breach is still logged/notified.
export function escalatePriority(current: TicketPriority): TicketPriority {
  const index = ESCALATION_ORDER.indexOf(current);
  // indexOf returns -1 for a value outside the enum (stale/legacy data) —
  // without this check, -1 + 1 = 0 silently DOWNGRADES an unrecognized
  // priority to LOW instead of escalating it, the opposite of this
  // function's purpose. The caller (SlaEscalationService) catches this
  // per-ticket so one bad row can't abort the whole breach-check batch.
  if (index === -1) {
    throw new Error(`Cannot escalate unknown ticket priority: ${current}`);
  }
  return ESCALATION_ORDER[Math.min(index + 1, ESCALATION_ORDER.length - 1)];
}
