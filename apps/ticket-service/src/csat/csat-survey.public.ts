// A discriminated-union-ish shape rather than three separate endpoints —
// the client only ever needs "what do I show right now" in one round trip:
// the question list if nothing's answered yet, or the locked-in answers if
// it already has been. `not_available` covers both "ticket isn't closed"
// and "somehow no survey row exists yet" — the caller (ChatPanel) treats
// both the same way: don't show anything CSAT-related.
export type PublicCsatSurveyStatus = 'not_available' | 'pending' | 'submitted';

export interface PublicCsatQuestionOption {
  id: string;
  text: string;
}

export interface PublicCsatSubmittedAnswer {
  questionText: string;
  score: number;
}

export interface PublicCsatSurvey {
  status: PublicCsatSurveyStatus;
  questions?: PublicCsatQuestionOption[];
  answers?: PublicCsatSubmittedAnswer[];
  submittedAt?: Date | null;
}
