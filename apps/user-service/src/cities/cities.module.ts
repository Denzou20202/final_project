import { CityEntity, UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CitiesController } from './cities.controller.js';
import { CitiesRepository } from './cities.repository.js';
import { CitiesService } from './cities.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CityEntity, UserEntity])],
  controllers: [CitiesController],
  providers: [CitiesService, CitiesRepository],
  exports: [CitiesRepository],
})
export class CitiesModule {}
