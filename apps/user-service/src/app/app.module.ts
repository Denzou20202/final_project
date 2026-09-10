import { MetricsModule } from '@veloxdesk/common';
import { entities } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { CitiesModule } from '../cities/cities.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { ContactsModule } from '../contacts/contacts.module.js';
import { EmployeeStatusesModule } from '../employee-statuses/employee-statuses.module.js';
import { LdapConfigModule } from '../ldap-config/ldap-config.module.js';
import { OidcConfigModule } from '../oidc-config/oidc-config.module.js';
import { PermissionGroupsModule } from '../permission-groups/permission-groups.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { UsersModule } from '../users/users.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'veloxdesk'),
        password: config.get<string>('DB_PASSWORD', 'secret'),
        database: config.get<string>('DB_NAME', 'veloxdesk'),
        entities,
        synchronize: false,
        // Pool sizing: each microservice keeps its own pool against the same
        // Postgres instance, so this must stay well under max_connections
        // once more services come online (see conn-limits in the Postgres
        // best-practices skill).
        extra: {
          max: config.get<number>('DB_POOL_MAX', 10),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 2_000,
        },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    UsersModule,
    AuthModule,
    TeamsModule,
    PermissionGroupsModule,
    EmployeeStatusesModule,
    ContactsModule,
    CompaniesModule,
    CitiesModule,
    LdapConfigModule,
    OidcConfigModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
