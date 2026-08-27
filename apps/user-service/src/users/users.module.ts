import { UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DirectorySecretEncryptionService } from '../auth/directory-secret-encryption.service.js';
import { TotpEncryptionService } from '../auth/totp-encryption.service.js';
import { TotpService } from '../auth/totp.service.js';
import { CitiesModule } from '../cities/cities.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { EmployeeStatusesModule } from '../employee-statuses/employee-statuses.module.js';
import { PermissionGroupsModule } from '../permission-groups/permission-groups.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { UserEventsModule } from '../user-events/user-events.module.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

// TotpService/TotpEncryptionService live here (not AuthModule, which is
// where they conceptually "belong") specifically so UsersService can use
// them for the self-targeting password/2FA-reset re-auth check below —
// AuthModule already imports UsersModule, so declaring them there instead
// would be a circular module dependency. Both are dependency-free (just
// otplib/ConfigService/crypto), safe to own from either side; AuthModule
// still gets them transitively through its existing UsersModule import.
// DirectorySecretEncryptionService rides along in the same spot for the
// same reason — LdapConfigModule/OidcConfigModule (which encrypt/decrypt
// bind passwords and client secrets) import UsersModule to reach it rather
// than each redeclaring their own instance of a dependency-free wrapper.
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    PermissionGroupsModule,
    EmployeeStatusesModule,
    TeamsModule,
    UserEventsModule,
    CompaniesModule,
    CitiesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, TotpService, TotpEncryptionService, DirectorySecretEncryptionService],
  exports: [UsersService, TotpService, TotpEncryptionService, DirectorySecretEncryptionService],
})
export class UsersModule {}
