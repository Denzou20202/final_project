import { CityEntity } from '@veloxdesk/database';

export interface PublicCity {
  id: string;
  name: string;
  createdAt: Date;
}

export function toPublicCity(city: CityEntity): PublicCity {
  return {
    id: city.id,
    name: city.name,
    createdAt: city.createdAt,
  };
}
