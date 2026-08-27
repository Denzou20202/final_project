import { MacroEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MacrosController } from './macros.controller.js';
import { MacrosRepository } from './macros.repository.js';
import { MacrosService } from './macros.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([MacroEntity])],
  controllers: [MacrosController],
  providers: [MacrosService, MacrosRepository],
})
export class MacrosModule {}
