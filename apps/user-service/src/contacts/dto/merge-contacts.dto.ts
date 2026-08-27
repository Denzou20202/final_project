import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class MergeContactsDto {
  @ApiProperty({ description: 'The contact that survives the merge — every other id\'s tickets/comments/etc. move onto this one' })
  @IsUUID()
  primaryId!: string;

  @ApiProperty({ type: [String], description: 'Contacts to fold into primaryId; each is soft-deleted and flagged mergedIntoId afterwards' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  duplicateIds!: string[];
}
