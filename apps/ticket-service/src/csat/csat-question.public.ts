import { CsatQuestionEntity } from '@veloxdesk/database';

export interface PublicCsatQuestion {
  id: string;
  text: string;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicCsatQuestion(question: CsatQuestionEntity): PublicCsatQuestion {
  return {
    id: question.id,
    text: question.text,
    isEnabled: question.isEnabled,
    sortOrder: question.sortOrder,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}
