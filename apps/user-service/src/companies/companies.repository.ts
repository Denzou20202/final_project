import { CompanyEntity, UserEntity } from '@veloxdesk/database';
import { UserRole } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class CompaniesRepository {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companiesRepository: Repository<CompanyEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  findAll(): Promise<CompanyEntity[]> {
    return this.companiesRepository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<CompanyEntity | null> {
    return this.companiesRepository.findOne({ where: { id } });
  }

  findByName(name: string): Promise<CompanyEntity | null> {
    return this.companiesRepository.findOne({ where: { name } });
  }

  async create(name: string): Promise<CompanyEntity> {
    return this.companiesRepository.save(this.companiesRepository.create({ name }));
  }

  async updateName(id: string, name: string): Promise<void> {
    await this.companiesRepository.update({ id }, { name });
  }

  // Backs the delete-company guard — CompaniesService.remove() must know
  // this BEFORE deleting. Unlike TicketCategoriesRepository's equivalent,
  // this is a string match, not a FK count: UserEntity.company stays a
  // plain column (see CompanyEntity's own comment), so "in use" means
  // "some client's stored value currently equals this name", not "some row
  // references this id". Scoped to role=client since staff never has this
  // field populated (EditUserModal hides it for operators) — redundant
  // given the string wouldn't match anyway, but states the intent plainly.
  // withDeleted: a deactivated client's stored `company` value is still a
  // real reference to this row's name — without it, count() silently
  // excludes deactivated clients (TypeORM's default soft-delete filter),
  // undercounting against what "still in use" actually means here.
  async countUsersWithCompany(name: string): Promise<number> {
    return this.usersRepository.count({ where: { role: UserRole.CLIENT, company: name }, withDeleted: true });
  }

  async delete(id: string): Promise<void> {
    await this.companiesRepository.delete({ id });
  }
}
