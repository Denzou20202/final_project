import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { AuthAudience, UserRole } from '@veloxdesk/types';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpsertLdapConfigDto } from './dto/upsert-ldap-config.dto.js';
import { LdapConfigService } from './ldap-config.service.js';

// Admin-only, both reads and writes — unlike permission-groups (whose list
// operators can also read), this holds a service-account bind DN and a
// "has a secret set" flag that has no reason to be visible outside admin
// settings.
@ApiTags('ldap-config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('ldap-config')
export class LdapConfigController {
  constructor(private readonly ldapConfigService: LdapConfigService) {}

  @Get(':audience')
  findByAudience(@Param('audience', new ParseEnumPipe(AuthAudience)) audience: AuthAudience) {
    return this.ldapConfigService.findByAudience(audience);
  }

  @Put(':audience')
  upsert(
    @Param('audience', new ParseEnumPipe(AuthAudience)) audience: AuthAudience,
    @Body() dto: UpsertLdapConfigDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.ldapConfigService.upsert(audience, dto, actor);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':audience/test-connection')
  testConnection(@Param('audience', new ParseEnumPipe(AuthAudience)) audience: AuthAudience, @CurrentUser() actor: JwtPayload) {
    return this.ldapConfigService.testConnection(audience, actor);
  }
}
