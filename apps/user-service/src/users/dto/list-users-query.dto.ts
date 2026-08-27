import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page\'s nextCursor' })
  @IsOptional()
  @IsString()
  cursor?: string;

  // Free-text match against fullName/email — backs an async-search picker
  // (report filters' client field in particular, see ReportFiltersForm.tsx)
  // where the plain createdAt-keyset page (capped at `limit`, no way to
  // reach anyone past the first page) can't find a specific client among
  // thousands. Switches findPage into a name-ordered ILIKE query instead of
  // its usual keyset pagination — see UsersRepository.findPage.
  @ApiPropertyOptional({ description: 'Free-text match against name/email' })
  @IsOptional()
  @IsString()
  search?: string;
}
