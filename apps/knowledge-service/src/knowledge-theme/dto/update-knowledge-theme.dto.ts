import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateKnowledgeThemeDto {
  @ApiPropertyOptional({ description: 'Injected as a <style> tag on the public FAQ pages; empty clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  customCss?: string;

  @ApiPropertyOptional({ description: 'Injected and executed as a <script> tag on the public FAQ pages; empty clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  customJs?: string;
}
