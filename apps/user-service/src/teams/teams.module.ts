import { TeamEntity, TeamMemberEntity, UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEventsModule } from '../user-events/user-events.module.js';
import { TeamsController } from './teams.controller.js';
import { TeamsRepository } from './teams.repository.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TeamEntity, TeamMemberEntity, UserEntity]), UserEventsModule],
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository],
  exports: [TeamsService],
})
export class TeamsModule {}
