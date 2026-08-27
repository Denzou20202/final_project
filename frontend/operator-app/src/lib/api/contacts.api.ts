import { userApi } from './client.js';
import type { PublicDuplicateGroup, PublicUser } from '../types.js';

// A plain <a href> can't carry the Authorization header, so the file is
// fetched as a blob through the authenticated axios instance and then
// "downloaded" via a synthetic click on an object URL — same pattern as
// downloadReportCsv (reports.api.ts).
function saveBlob(blob: Blob, filenamePrefix: string, extension = 'csv'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `veloxdesk-${filenamePrefix}-${Date.now()}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadContactsCsv(): Promise<void> {
  const response = await userApi.get('/users/contacts/export', { responseType: 'blob' });
  saveBlob(response.data as Blob, 'contacts');
}

export async function fetchDuplicateContacts(): Promise<PublicDuplicateGroup[]> {
  const { data } = await userApi.get<PublicDuplicateGroup[]>('/users/contacts/duplicates');
  return data;
}

export async function mergeContacts(input: { primaryId: string; duplicateIds: string[] }): Promise<PublicUser> {
  const { data } = await userApi.post<PublicUser>('/users/contacts/merge', input);
  return data;
}
