import { userApi } from './client.js';
import type { PublicCity } from '../types.js';

export async function listCities(): Promise<PublicCity[]> {
  const { data } = await userApi.get<PublicCity[]>('/cities');
  return data;
}

export async function createCity(name: string): Promise<PublicCity> {
  const { data } = await userApi.post<PublicCity>('/cities', { name });
  return data;
}

export async function renameCity(id: string, name: string): Promise<PublicCity> {
  const { data } = await userApi.patch<PublicCity>(`/cities/${id}`, { name });
  return data;
}

export async function deleteCity(id: string): Promise<void> {
  await userApi.delete(`/cities/${id}`);
}
