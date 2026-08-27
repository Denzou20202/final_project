import { SettingsAuditLogModule } from '@veloxdesk/common';
import { OidcConfigEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { OidcConfigController } from './oidc-config.controller.js';
import { OidcConfigService } from './oidc-config.service.js';

// Mirrors LdapConfigModule exactly — see that module's comment on why
// UsersModule is imported (DirectorySecretEncryptionService) and why this
// isn't circular with AuthModule.
@Module({
  imports: [TypeOrmModule.forFeature([OidcConfigEntity]), UsersModule, SettingsAuditLogModule],
  controllers: [OidcConfigController],
  providers: [OidcConfigService],
  exports: [OidcConfigService],
})
export class OidcConfigModule {}
