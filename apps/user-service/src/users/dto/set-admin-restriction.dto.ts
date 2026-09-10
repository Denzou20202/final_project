import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetAdminRestrictionDto {
  @ApiProperty({ description: 'true = this admin cannot create or manage other ADMIN accounts' })
  @IsBoolean()
  cannotManageAdmins!: boolean;
}
