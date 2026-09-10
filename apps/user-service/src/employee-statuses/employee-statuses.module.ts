import { EmployeeStatusEntity, EmployeeStatusHistoryEntity, PresenceSettingsEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeStatusesController } from './employee-statuses.controller.js';
import { EmployeeStatusesRepository } from './employee-statuses.repository.js';
import { EmployeeStatusesService } from './employee-statuses.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeStatusEntity, EmployeeStatusHistoryEntity, PresenceSettingsEntity])],
  controllers: [EmployeeStatusesController],
  providers: [EmployeeStatusesService, EmployeeStatusesRepository],
  exports: [EmployeeStatusesService],
})
export class EmployeeStatusesModule {}
