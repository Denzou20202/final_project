import { SavedReportEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller.js';
import { ReportsRepository } from './reports.repository.js';
import { ReportsService } from './reports.service.js';
import { SavedReportsRepository } from './saved-reports.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([SavedReportEntity])],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository, SavedReportsRepository],
})
export class ReportsModule {}
