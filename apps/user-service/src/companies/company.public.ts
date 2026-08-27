import { CompanyEntity } from '@veloxdesk/database';

export interface PublicCompany {
  id: string;
  name: string;
  createdAt: Date;
}

export function toPublicCompany(company: CompanyEntity): PublicCompany {
  return {
    id: company.id,
    name: company.name,
    createdAt: company.createdAt,
  };
}
