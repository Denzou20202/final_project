import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PublicCity, toPublicCity } from './city.public.js';
import { CitiesRepository } from './cities.repository.js';

// See CompaniesService's own comment — same reasoning, mirrors
// sla-policies.service.ts's translateUniqueViolation pattern.
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class CitiesService {
  constructor(private readonly citiesRepository: CitiesRepository) {}

  async listAll(): Promise<PublicCity[]> {
    const cities = await this.citiesRepository.findAll();
    return cities.map(toPublicCity);
  }

  async create(name: string): Promise<PublicCity> {
    const trimmed = name.trim();
    const collision = await this.citiesRepository.findByName(trimmed);
    if (collision) {
      throw new ConflictException(`Город «${trimmed}» уже существует`);
    }
    try {
      const city = await this.citiesRepository.create(trimmed);
      return toPublicCity(city);
    } catch (error) {
      throw this.translateUniqueViolation(error, trimmed);
    }
  }

  // See CompaniesService.rename — same reasoning, doesn't retroactively
  // update users.city on already-onboarded clients.
  async rename(id: string, name: string): Promise<PublicCity> {
    const city = await this.citiesRepository.findById(id);
    if (!city) {
      throw new NotFoundException('City not found');
    }

    const trimmed = name.trim();
    if (trimmed === city.name) {
      return toPublicCity(city);
    }

    const collision = await this.citiesRepository.findByName(trimmed);
    if (collision) {
      throw new ConflictException(`Город «${trimmed}» уже существует`);
    }

    try {
      await this.citiesRepository.updateName(id, trimmed);
    } catch (error) {
      throw this.translateUniqueViolation(error, trimmed);
    }
    return toPublicCity({ ...city, name: trimmed });
  }

  private translateUniqueViolation(error: unknown, name: string): unknown {
    if (error instanceof QueryFailedError && (error as unknown as { code?: string }).code === UNIQUE_VIOLATION) {
      return new ConflictException(`Город «${name}» уже существует`);
    }
    return error;
  }

  async remove(id: string): Promise<void> {
    const city = await this.citiesRepository.findById(id);
    if (!city) {
      throw new NotFoundException('City not found');
    }
    const userCount = await this.citiesRepository.countUsersWithCity(city.name);
    if (userCount > 0) {
      throw new BadRequestException(
        `Нельзя удалить город «${city.name}» — он указан у клиентов (${userCount}). Сначала смените город в их профилях.`,
      );
    }
    await this.citiesRepository.delete(id);
  }
}
