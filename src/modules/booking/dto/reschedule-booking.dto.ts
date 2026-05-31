import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RescheduleBookingDto {
  @ApiProperty({ description: 'New scheduled date' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({ description: 'New time slot' })
  @IsString()
  @IsOptional()
  timeSlot?: string;

  @ApiPropertyOptional({ description: 'Optional reason for the reschedule' })
  @IsString()
  @IsOptional()
  reason?: string;
}
