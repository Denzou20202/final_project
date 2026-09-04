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

  // Free-text match against fullName/email — backs both an async-search
  // picker (report filters' client field, see ReportFiltersForm.tsx) and the
  // paginated admin Users table (UsersPage.tsx), where the plain
  // createdAt-keyset page (capped at `limit`, no way to reach anyone past
  // the first page) can't find a specific client among thousands. Switches
  // findPage into a name-ordered ILIKE query, keyset-paginated by
  // (fullName, id) instead of the usual (createdAt, id) — see
  // UsersRepository.findPage and NameCursor.
  @ApiPropertyOptional({ description: 'Free-text match against name/email' })
  @IsOptional()
  @IsString()
  search?: string;
}
