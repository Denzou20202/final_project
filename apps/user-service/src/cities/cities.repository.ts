import { CityEntity, UserEntity } from '@veloxdesk/database';
import { UserRole } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class CitiesRepository {
  constructor(
    @InjectRepository(CityEntity)
    private readonly citiesRepository: Repository<CityEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  findAll(): Promise<CityEntity[]> {
    return this.citiesRepository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<CityEntity | null> {
    return this.citiesRepository.findOne({ where: { id } });
  }

  findByName(name: string): Promise<CityEntity | null> {
    return this.citiesRepository.findOne({ where: { name } });
  }

  async create(name: string): Promise<CityEntity> {
    return this.citiesRepository.save(this.citiesRepository.create({ name }));
  }

  async updateName(id: string, name: string): Promise<void> {
    await this.citiesRepository.update({ id }, { name });
  }

  // See CompaniesRepository.countUsersWithCompany — same string-match
  // guard shape (including withDeleted, for the same reason), just against
  // UserEntity.city instead of .company.
  async countUsersWithCity(name: string): Promise<number> {
    return this.usersRepository.count({ where: { role: UserRole.CLIENT, city: name }, withDeleted: true });
  }

  async delete(id: string): Promise<void> {
    await this.citiesRepository.delete({ id });
  }
}
