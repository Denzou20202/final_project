import { AuthAudience } from '@veloxdesk/types';
import { Controller, Get, Query } from '@nestjs/common';
import { LdapConfigService } from '../ldap-config/ldap-config.service.js';
import { OidcConfigService } from '../oidc-config/oidc-config.service.js';

export interface AvailableAuthMethods {
  local: boolean;
  ldap: { enabled: boolean };
  oidc: { enabled: boolean; loginUrl?: string };
}

// Public, unauthenticated — both frontends call this before rendering their
// login form, so it must be reachable with no session. Never returns a
// secret, only booleans and a login URL, deliberately kept separate from
// LdapConfigController/OidcConfigController (which ARE admin-only).
@Controller('auth')
export class AvailableAuthMethodsController {
  constructor(
    private readonly ldapConfigService: LdapConfigService,
    private readonly oidcConfigService: OidcConfigService,
  ) {}

  @Get('available-methods')
  async availableMethods(@Query('audience') audienceParam?: string): Promise<AvailableAuthMethods> {
    const audience = audienceParam === AuthAudience.STAFF ? AuthAudience.STAFF : AuthAudience.CLIENT;

    const [ldapConfig, oidcConfig] = await Promise.all([
      this.ldapConfigService.findEnabledForAudience(audience),
      this.oidcConfigService.findEnabledForAudience(audience),
    ]);

    return {
      local: !ldapConfig && !oidcConfig,
      ldap: { enabled: !!ldapConfig },
      oidc: { enabled: !!oidcConfig, ...(oidcConfig && { loginUrl: `/api/auth/oidc/${audience}/login` }) },
    };
  }
}
