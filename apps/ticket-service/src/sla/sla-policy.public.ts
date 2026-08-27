import { SlaPolicyEntity } from '@veloxdesk/database';
import { TicketPriority } from '@veloxdesk/types';

export interface PublicSlaPolicy {
  id: string;
  name: string;
  responseTimeMin: number;
  resolutionTimeMin: number;
  priority: TicketPriority;
}

export function toPublicSlaPolicy(policy: SlaPolicyEntity): PublicSlaPolicy {
  return {
    id: policy.id,
    name: policy.name,
    responseTimeMin: policy.responseTimeMin,
    resolutionTimeMin: policy.resolutionTimeMin,
    priority: policy.priority,
  };
}
