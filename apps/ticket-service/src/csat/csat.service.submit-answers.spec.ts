import { UserRole } from '@veloxdesk/types';
import { BadRequestException } from '@nestjs/common';
import { CsatService } from './csat.service.js';

function makeActor(overrides: Record<string, unknown> = {}) {
  return { sub: 'client-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT, ...overrides };
}

const closedOwnTicket = { id: 'ticket-1', createdBy: 'client-1', status: { isClosed: true } };
const openSurvey = { id: 'survey-1', submittedAt: null };

// Regression coverage: submitAnswers previously had no guard against a
// single request's own `answers` array listing the same questionId twice —
// see AddCsatAnswersUniqueQuestionPerSurvey migration's own comment for why
// that used to insert duplicate csat_answers rows unchecked, skewing
// per-question averages in the CSAT report.
describe('CsatService.submitAnswers — duplicate questionId in one payload', () => {
  let ticketsRepository: { findOne: jest.Mock };
  let csatRepository: { findSurveyByTicketId: jest.Mock };
  let questionsRepository: { findByIds: jest.Mock };
  let service: CsatService;

  beforeEach(() => {
    ticketsRepository = { findOne: jest.fn().mockResolvedValue(closedOwnTicket) };
    csatRepository = { findSurveyByTicketId: jest.fn().mockResolvedValue(openSurvey) };
    questionsRepository = { findByIds: jest.fn().mockResolvedValue([{ id: 'q1', text: 'How was it?' }]) };

    service = new CsatService(
      csatRepository as never,
      questionsRepository as never,
      ticketsRepository as never,
      {} as never, // activityRepository
      {} as never, // mentionsRepository
      {} as never, // dataSource
    );
  });

  it('rejects a payload with the same questionId listed twice, before touching the DB', async () => {
    await expect(
      service.submitAnswers(
        'ticket-1',
        makeActor(),
        [
          { questionId: 'q1', score: 5 },
          { questionId: 'q1', score: 1 },
        ],
      ),
    ).rejects.toThrow(BadRequestException);

    expect(questionsRepository.findByIds).not.toHaveBeenCalled();
  });
});
