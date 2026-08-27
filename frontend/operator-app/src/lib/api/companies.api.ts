import { userApi } from './client.js';
import type { PublicCompany } from '../types.js';

export async function listCompanies(): Promise<PublicCompany[]> {
  const { data } = await userApi.get<PublicCompany[]>('/companies');
  return data;
}

export async function createCompany(name: string): Promise<PublicCompany> {
  const { data } = await userApi.post<PublicCompany>('/companies', { name });
  return data;
}

export async function renameCompany(id: string, name: string): Promise<PublicCompany> {
  const { data } = await userApi.patch<PublicCompany>(`/companies/${id}`, { name });
  return data;
}

export async function deleteCompany(id: string): Promise<void> {
  await userApi.delete(`/companies/${id}`);
}
