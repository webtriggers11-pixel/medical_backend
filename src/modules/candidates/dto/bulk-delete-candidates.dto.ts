import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

/** Payload for soft-deleting many candidates in one request. */
export class BulkDeleteCandidatesDto {
  @ApiProperty({
    type: [String],
    example: ['clr1candidate...', 'clr2candidate...'],
    description: 'Candidate ids to soft-delete',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'ids must contain at least one candidate id' })
  @ArrayUnique()
  @IsString({ each: true })
  ids: string[];
}
