import { MetricsModule } from '@veloxdesk/common';
import { entities } from '@veloxdesk/database';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AutomationRulesModule } from '../automation/automation-rules.module.js';
import { CsatModule } from '../csat/csat.module.js';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module.js';
import { EmailIngestionModule } from '../email-ingestion/email-ingestion.module.js';
import { MacrosModule } from '../macros/macros.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { TelegramIngestionModule } from '../telegram-ingestion/telegram-ingestion.module.js';
import { TicketCategoriesModule } from '../ticket-categories/ticket-categories.module.js';
import { TicketStatusesModule } from '../ticket-statuses/ticket-statuses.module.js';
import { TicketTypesModule } from '../ticket-types/ticket-types.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { TranslateModule } from '../translate/translate.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
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
    AuthModule,
    CsatModule,
    TicketsModule,
    EmailIngestionModule,
    TelegramIngestionModule,
    AttachmentsModule,
    MacrosModule,
    CustomFieldsModule,
    AutomationRulesModule,
    TagsModule,
    TicketCategoriesModule,
    TicketStatusesModule,
    TicketTypesModule,
    TranslateModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
