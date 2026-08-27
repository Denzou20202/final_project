import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MergeTicketDto {
  @ApiProperty({ description: 'The surviving ticket — this ticket\'s comments/attachments move there and it gets closed' })
  @IsUUID()
  targetTicketId!: string;
}
