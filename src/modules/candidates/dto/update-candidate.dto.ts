import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCandidateDto } from './create-candidate.dto';

/**
 * Admin candidate edit.
 *
 * `storeId` is intentionally omitted: a candidate's store (and therefore its
 * client) is immutable, because re-scoping a candidate to a different client
 * would orphan its existing bookings and reports. Every other field is
 * optional so the admin can patch just what changed.
 */
export class UpdateCandidateDto extends PartialType(
  OmitType(CreateCandidateDto, ['storeId'] as const),
) {}
