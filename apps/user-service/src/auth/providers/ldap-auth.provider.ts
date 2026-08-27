import { AuthAudience } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { LdapConfigService } from '../../ldap-config/ldap-config.service.js';
import { AuthenticatedIdentity, DirectoryCredentialProvider } from './auth-provider.interface.js';

// Thin adapter: the actual bind/search logic lives in
// ldap-config/ldap-directory-client.ts (shared with LdapConfigService
// .testConnection so a login and an admin's "Test connection" click run the
// exact same code path against the directory).
@Injectable()
export class LdapAuthProvider implements DirectoryCredentialProvider {
  constructor(private readonly ldapConfigService: LdapConfigService) {}

  async validate(username: string, password: string, audience: AuthAudience): Promise<AuthenticatedIdentity | null> {
    return this.ldapConfigService.findAndBindUser(audience, username, password);
  }
}
