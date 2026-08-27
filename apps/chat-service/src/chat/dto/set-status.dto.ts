import { IsOptional, IsUUID } from 'class-validator';

// null clears back to the default «Онлайн»; omitted is treated the same way
// by the service layer, but the client always sends one or the other.
export class SetStatusDto {
  @IsOptional()
  @IsUUID()
  statusId?: string | null;
}
