import { IsString, IsUUID, MinLength } from 'class-validator';

export class EditMessageDto {
  @IsUUID()
  ticketId!: string;

  @IsUUID()
  commentId!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
