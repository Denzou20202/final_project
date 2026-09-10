import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PublicCompany, toPublicCompany } from './company.public.js';
import { CompaniesRepository } from './companies.repository.js';

// Raised by the UNIQUE constraint on name — the findByName pre-check below
// is only an early, friendlier error for the common case; two concurrent
// creates/renames to the same name can both pass it, and this is what
// actually stops the second one from inserting/updating a duplicate. Same
// pattern as sla-policies.service.ts's own translateUniqueViolation.
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class CompaniesService {
  constructor(private readonly companiesRepository: CompaniesRepository) {}

  async listAll(): Promise<PublicCompany[]> {
    const companies = await this.companiesRepository.findAll();
    return companies.map(toPublicCompany);
  }

  async create(name: string): Promise<PublicCompany> {
    const trimmed = name.trim();
    const collision = await this.companiesRepository.findByName(trimmed);
    if (collision) {
      throw new ConflictException(`Компания «${trimmed}» уже существует`);
    }
    try {
      const company = await this.companiesRepository.create(trimmed);
      return toPublicCompany(company);
    } catch (error) {
      throw this.translateUniqueViolation(error, trimmed);
    }
  }

  // Admin-only, global — renaming changes what every client already holding
  // this value displays, not just this one request's view of it. Does NOT
  // retroactively update users.company on already-onboarded clients — see
  // CompanyEntity's own comment on why that column stays a plain string.
  async rename(id: string, name: string): Promise<PublicCompany> {
    const company = await this.companiesRepository.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const trimmed = name.trim();
    if (trimmed === company.name) {
      return toPublicCompany(company);
    }

    const collision = await this.companiesRepository.findByName(trimmed);
    if (collision) {
      throw new ConflictException(`Компания «${trimmed}» уже существует`);
    }

    try {
      await this.companiesRepository.updateName(id, trimmed);
    } catch (error) {
      throw this.translateUniqueViolation(error, trimmed);
    }
    return toPublicCompany({ ...company, name: trimmed });
  }

  private translateUniqueViolation(error: unknown, name: string): unknown {
    if (error instanceof QueryFailedError && (error as unknown as { code?: string }).code === UNIQUE_VIOLATION) {
      return new ConflictException(`Компания «${name}» уже существует`);
    }
    return error;
  }

  // Guarded at the app level — mirrors TeamsService.remove()/TagsService
  // .remove()'s count-then-reject shape, just counting a string match
  // instead of a FK (see CompaniesRepository.countUsersWithCompany).
  async remove(id: string): Promise<void> {
    const company = await this.companiesRepository.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    const userCount = await this.companiesRepository.countUsersWithCompany(company.name);
    if (userCount > 0) {
      throw new BadRequestException(
        `Нельзя удалить компанию «${company.name}» — она указана у клиентов (${userCount}). Сначала смените компанию в их профилях.`,
      );
    }
    await this.companiesRepository.delete(id);
  }
}
