import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignCategoryDto {
  @ApiProperty({ type: String, nullable: true, description: 'null убирает категорию с тикета' })
  @IsOptional()
  @IsUUID('4')
  categoryId!: string | null;
}
