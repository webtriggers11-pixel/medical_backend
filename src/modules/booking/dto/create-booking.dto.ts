import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ description: 'Candidate being booked' })
  @IsString()
  candidateId: string;

  @ApiProperty({ description: 'Panel selected for this candidate' })
  @IsString()
  panelId: string;

  @ApiProperty({ description: 'Preferred appointment date (ISO8601)' })
  @IsDateString()
  reqDate: string;

  @ApiPropertyOptional({ description: 'Time slot e.g. "9:00 AM - 10:00 AM"' })
  @IsString()
  @IsOptional()
  timeSlot?: string;
}
