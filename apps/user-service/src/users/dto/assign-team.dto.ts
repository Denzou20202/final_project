import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignTeamDto {
  @ApiProperty({ type: String, nullable: true, description: 'null убирает пользователя из всех отделов' })
  @IsOptional()
  @IsUUID('4')
  teamId!: string | null;
}
