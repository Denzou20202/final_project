import { Injectable } from '@nestjs/common';

@Injectable()
export class GatewayConfigService {
  readonly userServiceUrl = (process.env.USER_SERVICE_URL || 'http://localhost:3002').replace(/\/$/, '');
  readonly ticketServiceUrl = (process.env.TICKET_SERVICE_URL || 'http://localhost:3011').replace(/\/$/, '');
  readonly chatServiceUrl = (process.env.CHAT_SERVICE_URL || 'http://localhost:3004').replace(/\/$/, '');
  readonly knowledgeServiceUrl = (process.env.KNOWLEDGE_SERVICE_URL || 'http://localhost:3006').replace(/\/$/, '');
  readonly analyticsServiceUrl = (process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3005').replace(/\/$/, '');

  resolveUpstream(path: string): string | null {
    const cleanPath = path.replace(/^\/api/, '').replace(/^\//, '');
    const firstSegment = cleanPath.split('/')[0]?.split('?')[0];

    switch (firstSegment) {
      case 'auth':
      case 'users':
      case 'companies':
      case 'cities':
      case 'permission-groups':
      case 'teams':
      case 'contacts':
      case 'oidc-config':
      case 'ldap-config':
        return this.userServiceUrl;

      case 'tickets':
      case 'ticket-statuses':
      case 'ticket-types':
      case 'ticket-categories':
      case 'sla-policies':
      case 'custom-fields':
      case 'macros':
      case 'automation-rules':
      case 'attachments':
        return this.ticketServiceUrl;

      case 'chats':
      case 'messages':
        return this.chatServiceUrl;

      case 'articles':
      case 'knowledge':
      case 'knowledge-theme':
        return this.knowledgeServiceUrl;

      case 'reports':
      case 'analytics':
      case 'audit-logs':
      case 'csat':
        return this.analyticsServiceUrl;

      default:
        return null;
    }
  }
}
