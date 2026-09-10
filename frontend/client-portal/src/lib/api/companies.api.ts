import { userApi } from './client.js';
import type { PublicCompany } from '../types.js';

// Read-only here — company management is an operator-app admin-settings
// feature (CompaniesModule, in user-service); a client only ever picks
// from the list on the onboarding form.
export async function listCompanies(): Promise<PublicCompany[]> {
  const { data } = await userApi.get<PublicCompany[]>('/companies');
  return data;
}
