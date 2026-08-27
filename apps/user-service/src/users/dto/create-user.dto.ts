import { UserRole } from '@veloxdesk/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

// Admin-only user creation — unlike RegisterDto (self-service, always
// UserRole.CLIENT), this lets an admin pick the role directly since there's
// no invite-by-email flow yet (SMTP isn't configured for every deployment).
export class CreateUserDto {
  @ApiProperty({ example: 'operator@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'a-strong-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Ivan Petrov' })
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  // Only meaningful when role = ADMIN — see UserEntity.cannotManageAdmins.
  // Ignored (stored as false) for any other role.
  @ApiPropertyOptional({ description: 'Restricted admin — cannot create or manage other ADMIN accounts' })
  @IsOptional()
  @IsBoolean()
  cannotManageAdmins?: boolean;

  // Only meaningful when role = CLIENT — see UserEntity.isVip. Ignored
  // (stored as false) for any other role.
  @ApiPropertyOptional({ description: 'VIP client — shows a badge next to their name' })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;
}
