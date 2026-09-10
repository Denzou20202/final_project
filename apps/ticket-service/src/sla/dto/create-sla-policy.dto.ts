import { TicketPriority } from '@veloxdesk/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateSlaPolicyDto {
  @ApiProperty({ example: 'SLA для высокого приоритета' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ example: 30, description: 'Время до первого ответа, минут' })
  @IsInt()
  @Min(1)
  responseTimeMin!: number;

  @ApiProperty({ example: 240, description: 'Время до решения, минут' })
  @IsInt()
  @Min(1)
  resolutionTimeMin!: number;

  @ApiProperty({ enum: TicketPriority })
  @IsEnum(TicketPriority)
  priority!: TicketPriority;
}
