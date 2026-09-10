import { SettingsAuditLogModule } from '@veloxdesk/common';
import { LdapConfigEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { LdapConfigController } from './ldap-config.controller.js';
import { LdapConfigService } from './ldap-config.service.js';

// UsersModule is imported only to reach DirectorySecretEncryptionService
// (see that module's comment) — LdapConfigModule has no other dependency on
// user management. AuthModule imports THIS module (for LdapAuthProvider and
// the /auth/available-methods lookup) — not the other way around, so there
// is no cycle even though both ultimately touch UsersModule.
@Module({
  imports: [TypeOrmModule.forFeature([LdapConfigEntity]), UsersModule, SettingsAuditLogModule],
  controllers: [LdapConfigController],
  providers: [LdapConfigService],
  exports: [LdapConfigService],
})
export class LdapConfigModule {}
