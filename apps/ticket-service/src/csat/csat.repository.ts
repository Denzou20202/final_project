import { CsatAnswerEntity, CsatSurveyEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class CsatRepository {
  constructor(
    @InjectRepository(CsatSurveyEntity)
    private readonly surveysRepository: Repository<CsatSurveyEntity>,
    @InjectRepository(CsatAnswerEntity)
    private readonly answersRepository: Repository<CsatAnswerEntity>,
  ) {}

  findSurveyByTicketId(ticketId: string): Promise<CsatSurveyEntity | null> {
    return this.surveysRepository.findOne({ where: { ticketId } });
  }

  createSurvey(ticketId: string): Promise<CsatSurveyEntity> {
    return this.surveysRepository.save(this.surveysRepository.create({ ticketId }));
  }

  findAnswersBySurveyId(surveyId: string): Promise<CsatAnswerEntity[]> {
    return this.answersRepository.find({ where: { surveyId }, order: { createdAt: 'ASC' } });
  }
}
