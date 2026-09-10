import { UserEntity, UserExtraDepartmentEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LdapConfigModule } from '../ldap-config/ldap-config.module.js';
import { OidcConfigModule } from '../oidc-config/oidc-config.module.js';
import { PermissionGroupsModule } from '../permission-groups/permission-groups.module.js';
import { UserEventsModule } from '../user-events/user-events.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AvailableAuthMethodsController } from './available-auth-methods.controller.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { LoginValidationFailureFilter } from './login-validation-failure.filter.js';
import { OidcAuthController } from './oidc-auth.controller.js';
import { LdapAuthProvider } from './providers/ldap-auth.provider.js';
import { LocalAuthProvider } from './providers/local-auth.provider.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { TurnstileService } from './turnstile.service.js';

// TotpService/TotpEncryptionService (used by AuthService below) now come
// transitively through UsersModule's own exports — see that module's
// comment for why they live there instead of being declared here directly.
// LdapConfigModule/OidcConfigModule are imported for their exported
// Ldap/OidcConfigService (used by AuthService.resolveLoginUser and by
// AvailableAuthMethodsController) — neither of those modules imports
// AuthModule back, so this isn't circular.
@Module({
  imports: [
    UsersModule,
    PermissionGroupsModule,
    UserEventsModule,
    LdapConfigModule,
    OidcConfigModule,
    TypeOrmModule.forFeature([UserEntity, UserExtraDepartmentEntity]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController, AvailableAuthMethodsController, OidcAuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalAuthProvider,
    LdapAuthProvider,
    LoginLockoutService,
    LoginValidationFailureFilter,
    TurnstileService,
  ],
})
export class AuthModule {}
