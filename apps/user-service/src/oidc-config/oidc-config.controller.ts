import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { AuthAudience, UserRole } from '@veloxdesk/types';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpsertOidcConfigDto } from './dto/upsert-oidc-config.dto.js';
import { OidcConfigService } from './oidc-config.service.js';

// Admin-only — mirrors LdapConfigController exactly (see that class's
// comment on why reads aren't opened up to operators the way
// permission-groups' list is).
@ApiTags('oidc-config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('oidc-config')
export class OidcConfigController {
  constructor(private readonly oidcConfigService: OidcConfigService) {}

  @Get(':audience')
  findByAudience(@Param('audience', new ParseEnumPipe(AuthAudience)) audience: AuthAudience) {
    return this.oidcConfigService.findByAudience(audience);
  }

  @Put(':audience')
  upsert(
    @Param('audience', new ParseEnumPipe(AuthAudience)) audience: AuthAudience,
    @Body() dto: UpsertOidcConfigDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.oidcConfigService.upsert(audience, dto, actor);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':audience/test-connection')
  testConnection(@Param('audience', new ParseEnumPipe(AuthAudience)) audience: AuthAudience, @CurrentUser() actor: JwtPayload) {
    return this.oidcConfigService.testConnection(audience, actor);
  }
}
