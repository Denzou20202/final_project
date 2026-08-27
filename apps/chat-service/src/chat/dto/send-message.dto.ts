import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  ticketId!: string;

  // No MinLength: a file-only message (no text, just staged attachments)
  // sends an empty body — MessageBubble skips rendering the text portion
  // entirely when it's empty, showing just the attached files.
  @IsString()
  body!: string;

  // Server re-checks this against the actor's role regardless (see
  // ChatService.postMessage) — a client claiming isInternal has no effect.
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
