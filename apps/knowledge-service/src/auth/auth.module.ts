import { UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy.js';

@Module({
  imports: [PassportModule, TypeOrmModule.forFeature([UserEntity])],
  providers: [JwtStrategy],
})
export class AuthModule {}
