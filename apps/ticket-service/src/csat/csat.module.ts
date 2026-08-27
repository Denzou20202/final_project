import {
  CsatAnswerEntity,
  CsatQuestionEntity,
  CsatSurveyEntity,
  TicketActivityEntity,
  TicketEntity,
  TicketMentionEntity,
} from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsatQuestionsController } from './csat-questions.controller.js';
import { CsatQuestionsRepository } from './csat-questions.repository.js';
import { CsatController } from './csat.controller.js';
import { CsatRepository } from './csat.repository.js';
import { CsatService } from './csat.service.js';

// Deliberately does NOT import TicketsModule — TicketsService needs to call
// CsatService.ensureSurveyForTicket() on close, and importing TicketsModule
// here too would create a module cycle. TicketEntity/TicketActivityEntity
// are registered directly instead, the same way chat-service (a genuinely
// separate microservice) already reads/writes them without going through
// ticket-service's own repository classes.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CsatQuestionEntity,
      CsatSurveyEntity,
      CsatAnswerEntity,
      TicketEntity,
      TicketActivityEntity,
      TicketMentionEntity,
    ]),
  ],
  controllers: [CsatQuestionsController, CsatController],
  providers: [CsatService, CsatRepository, CsatQuestionsRepository],
  exports: [CsatService],
})
export class CsatModule {}
