import { ticketApi } from './client.js';
import type { PublicCsatQuestion } from '../types.js';

export async function listCsatQuestions(): Promise<PublicCsatQuestion[]> {
  const { data } = await ticketApi.get<PublicCsatQuestion[]>('/csat/questions');
  return data;
}

export interface CsatQuestionInput {
  text: string;
  isEnabled?: boolean;
  sortOrder?: number;
}

export async function createCsatQuestion(input: CsatQuestionInput): Promise<PublicCsatQuestion> {
  const { data } = await ticketApi.post<PublicCsatQuestion>('/csat/questions', input);
  return data;
}

export async function updateCsatQuestion(
  id: string,
  input: Partial<CsatQuestionInput>,
): Promise<PublicCsatQuestion> {
  const { data } = await ticketApi.patch<PublicCsatQuestion>(`/csat/questions/${id}`, input);
  return data;
}

export async function deleteCsatQuestion(id: string): Promise<void> {
  await ticketApi.delete(`/csat/questions/${id}`);
}
