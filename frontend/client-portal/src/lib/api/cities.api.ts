import { userApi } from './client.js';
import type { PublicCity } from '../types.js';

// Read-only here — city management is an operator-app admin-settings
// feature (CitiesModule, in user-service); a client only ever picks
// from the list on the onboarding form.
export async function listCities(): Promise<PublicCity[]> {
  const { data } = await userApi.get<PublicCity[]>('/cities');
  return data;
}
