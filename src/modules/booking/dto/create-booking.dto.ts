import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional } from 'class-validator';

// Admin books a candidate by assigning a panel. The appointment date comes
// from the candidate's appointmentDate (set by HR at creation).
export class CreateBookingDto {
  @ApiProperty({ description: 'Candidate being booked' })
  @IsString()
  candidateId: string;

  @ApiProperty({ description: 'Panel chosen by admin for this candidate' })
  @IsString()
  panelId: string;

  @ApiPropertyOptional({
    description:
      'Override scheduled date (defaults to candidate appointmentDate)',
  })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Time slot e.g. "9:00 AM - 10:00 AM"' })
  @IsString()
  @IsOptional()
  timeSlot?: string;
}
