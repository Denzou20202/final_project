import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

// Body, not a :userId path param — this value is a long-lived, password-free
// way to fetch a session once approved (see AuthService.getRegistrationStatus),
// so it deliberately avoids sitting in URLs/access logs/browser history the
// way a path segment would.
export class RegistrationStatusDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;
}
