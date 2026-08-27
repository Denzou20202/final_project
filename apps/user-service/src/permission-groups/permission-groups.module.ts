import { SettingsAuditLogModule } from '@veloxdesk/common';
import { PermissionGroupDepartmentEntity, PermissionGroupEntity, TeamEntity, UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEventsModule } from '../user-events/user-events.module.js';
import { PermissionGroupsController } from './permission-groups.controller.js';
import { PermissionGroupsRepository } from './permission-groups.repository.js';
import { PermissionGroupsService } from './permission-groups.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionGroupEntity, PermissionGroupDepartmentEntity, TeamEntity, UserEntity]),
    SettingsAuditLogModule,
    UserEventsModule,
  ],
  controllers: [PermissionGroupsController],
  providers: [PermissionGroupsService, PermissionGroupsRepository],
  exports: [PermissionGroupsRepository],
})
export class PermissionGroupsModule {}
