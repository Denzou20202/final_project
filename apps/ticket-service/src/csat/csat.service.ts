import { JwtPayload, staffCanSeeTicket } from '@veloxdesk/common';
import { CsatAnswerEntity, CsatSurveyEntity, TicketActivityEntity, TicketEntity, TicketMentionEntity } from '@veloxdesk/database';
import { TicketActivityType, UserRole } from '@veloxdesk/types';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { CsatQuestionsRepository } from './csat-questions.repository.js';
import { PublicCsatQuestion, toPublicCsatQuestion } from './csat-question.public.js';
import { PublicCsatSurvey } from './csat-survey.public.js';
import { CsatRepository } from './csat.repository.js';
import { CreateCsatQuestionDto } from './dto/create-csat-question.dto.js';
import { CsatAnswerDto } from './dto/submit-csat.dto.js';
import { UpdateCsatQuestionDto } from './dto/update-csat-question.dto.js';

@Injectable()
export class CsatService {
  constructor(
    private readonly csatRepository: CsatRepository,
    private readonly questionsRepository: CsatQuestionsRepository,
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
    // Injected directly (not TicketsModule's TicketActivityRepository) —
    // CsatModule deliberately doesn't import TicketsModule, only the other
    // way round, so it can't reach that class. Same pattern chat-service
    // already uses for logging MESSAGE_EDITED into the same shared table.
    @InjectRepository(TicketActivityEntity)
    private readonly activityRepository: Repository<TicketActivityEntity>,
    @InjectRepository(TicketMentionEntity)
    private readonly mentionsRepository: Repository<TicketMentionEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // Called by TicketsService right after a ticket transitions into CLOSED
  // (manual or automated close — never on merge). Idempotent: a ticket only
  // ever gets one survey, no matter how many times it's closed/reopened.
  async ensureSurveyForTicket(ticketId: string): Promise<void> {
    const existing = await this.csatRepository.findSurveyByTicketId(ticketId);
    if (existing) return;
    try {
      await this.csatRepository.createSurvey(ticketId);
    } catch {
      // Unique constraint on ticket_id — a concurrent call already created
      // it between our check and insert. Harmless, nothing left to do.
    }
  }

  // ===== Admin question catalog =====

  async listQuestions(): Promise<PublicCsatQuestion[]> {
    const questions = await this.questionsRepository.findAll();
    return questions.map(toPublicCsatQuestion);
  }

  async createQuestion(dto: CreateCsatQuestionDto): Promise<PublicCsatQuestion> {
    const created = await this.questionsRepository.create(dto);
    return toPublicCsatQuestion(created);
  }

  async updateQuestion(id: string, dto: UpdateCsatQuestionDto): Promise<PublicCsatQuestion> {
    await this.getQuestionOrThrow(id);
    await this.questionsRepository.update(id, dto);
    const updated = await this.getQuestionOrThrow(id);
    return toPublicCsatQuestion(updated);
  }

  async deleteQuestion(id: string): Promise<void> {
    await this.getQuestionOrThrow(id);
    await this.questionsRepository.delete(id);
  }

  private async getQuestionOrThrow(id: string) {
    const question = await this.questionsRepository.findById(id);
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  // ===== Client-facing survey =====

  async getSurvey(ticketId: string, actor: JwtPayload): Promise<PublicCsatSurvey> {
    const ticket = await this.getTicketOrThrow(ticketId);
    await this.assertActorCanView(ticket, actor);

    const survey = await this.csatRepository.findSurveyByTicketId(ticketId);
    if (!survey) {
      return { status: 'not_available' };
    }
    if (!survey.submittedAt) {
      const questions = await this.questionsRepository.findEnabled();
      return {
        status: 'pending',
        questions: questions.map((q) => ({ id: q.id, text: q.text })),
      };
    }
    const answers = await this.csatRepository.findAnswersBySurveyId(survey.id);
    return {
      status: 'submitted',
      submittedAt: survey.submittedAt,
      answers: answers.map((a) => ({ questionText: a.questionText, score: a.score })),
    };
  }

  async submitAnswers(ticketId: string, actor: JwtPayload, answers: CsatAnswerDto[]): Promise<PublicCsatSurvey> {
    if (actor.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Only the client who owns this ticket can submit a CSAT survey');
    }
    const ticket = await this.getTicketOrThrow(ticketId);
    if (ticket.createdBy !== actor.sub) {
      throw new NotFoundException('Ticket not found');
    }
    if (!ticket.status.isClosed) {
      throw new BadRequestException('The survey is only available once the ticket is closed');
    }

    const survey = await this.csatRepository.findSurveyByTicketId(ticketId);
    if (!survey) {
      throw new NotFoundException('No survey available for this ticket yet');
    }
    if (survey.submittedAt) {
      throw new BadRequestException('This survey has already been submitted');
    }
    // A single request listing the same questionId twice used to insert two
    // rows unchecked (see the unique-index comment below) — rejected here
    // with a clear message rather than letting the second row hit that
    // constraint and surface as a raw 500.
    const questionIds = answers.map((a) => a.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
      throw new BadRequestException('Duplicate questionId in submission');
    }

    // One batched lookup instead of one findById per answer.
    const questions = await this.questionsRepository.findByIds(answers.map((a) => a.questionId));
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const rows = answers.map((answer) => {
      const question = questionById.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(`Unknown question: ${answer.questionId}`);
      }
      return {
        surveyId: survey.id,
        ticketId,
        questionId: question.id,
        questionText: question.text,
        score: answer.score,
      };
    });
    // One transaction, not two sequential awaits — a crash/restart landing
    // between them used to be able to leave `csat_answers` rows inserted
    // with the survey's `submitted_at` still null (a "started but never
    // finished" state that shouldn't be reachable at all: submitAnswers()
    // is the only writer, and it's meant to be all-or-nothing). Reports
    // reading `csat_surveys.submitted_at` (see analytics-service's CSAT
    // report) would otherwise show that ticket's rating date as 1970-01-01
    // (`new Date(null)` coerces to epoch, not "Invalid Date").
    //
    // The submittedAt check above reads the survey before this transaction
    // starts, so two concurrent submits (double-click, two tabs) can both
    // pass it and both reach here. The `(survey_id, question_id)` unique
    // index (see AddCsatAnswersUniqueQuestionPerSurvey) would eventually
    // stop a genuine duplicate insert, but only with a raw constraint
    // violation — claiming the survey via a conditional UPDATE first closes
    // the window cleanly instead: only whichever request's write actually
    // flips submitted_at from NULL gets to insert answer rows; the loser's
    // update affects zero rows and aborts the transaction instead of
    // reaching the insert at all. Same TOCTOU idiom as TicketsService.
    // updateStatus's self-assign race fix.
    await this.dataSource.transaction(async (manager) => {
      const result = await manager.update(
        CsatSurveyEntity,
        { id: survey.id, submittedAt: IsNull() },
        { submittedAt: new Date() },
      );
      if (!result.affected) {
        throw new BadRequestException('This survey has already been submitted');
      }
      await manager.insert(CsatAnswerEntity, rows);
    });

    const average = rows.reduce((sum, r) => sum + r.score, 0) / rows.length;
    await this.activityRepository.save(
      this.activityRepository.create({
        ticketId,
        actorId: actor.sub,
        type: TicketActivityType.CSAT_SUBMITTED,
        toValue: average.toFixed(1),
      }),
    );

    return this.getSurvey(ticketId, actor);
  }

  private async assertActorCanView(ticket: TicketEntity, actor: JwtPayload): Promise<void> {
    if (actor.role === UserRole.CLIENT) {
      if (ticket.createdBy !== actor.sub) {
        throw new NotFoundException('Ticket not found');
      }
      return;
    }
    if (staffCanSeeTicket(actor, ticket)) {
      return;
    }
    // Same department-restriction bypass as tickets.service.ts's
    // getOwnedTicketOrThrow — see TicketMentionEntity's own comment.
    const mentionCount = await this.mentionsRepository.count({ where: { ticketId: ticket.id, userId: actor.sub } });
    if (mentionCount === 0) {
      throw new NotFoundException('Ticket not found');
    }
  }

  private async getTicketOrThrow(ticketId: string): Promise<TicketEntity> {
    const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId }, relations: ['status'] });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }
}
