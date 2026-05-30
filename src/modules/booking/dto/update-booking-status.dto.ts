import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @ApiPropertyOptional({ description: 'Confirmed scheduled date (admin sets when confirming)' })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Time slot confirmed by admin' })
  @IsString()
  @IsOptional()
  timeSlot?: string;
}
