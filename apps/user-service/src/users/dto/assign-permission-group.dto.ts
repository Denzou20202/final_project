import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class AssignPermissionGroupDto {
  @ApiProperty({ type: String, nullable: true, description: 'null снимает группу — пользователь без ограничений' })
  @IsOptional()
  @IsUUID('4')
  permissionGroupId!: string | null;

  // Both fields only required/checked when the caller is assigning a group
  // to THEIR OWN account (id === actor.sub in
  // UsersService.assignPermissionGroup) — unlike the other admin-editable
  // fields on a user, this one carries real security policy
  // (PermissionGroupEntity.requireTwoFactor/ipWhitelist/restrictToDepartments),
  // so a stolen access token alone must not be enough to silently strip it.
  // Same re-auth shape as ResetTwoFactorDto/ResetUserPasswordDto above.
  // Assigning someone ELSE's group (the normal admin-panel case) needs
  // neither and stays unchanged.
  @ApiPropertyOptional({ description: 'Required when assigning a group to your own account' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'Required when assigning a group to your own account' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}
