import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { FitnessStatus } from '@prisma/client';

export class ReportFileDto {
  @ApiProperty({ description: 'Relative or absolute URL of the uploaded file' })
  @IsString()
  fileUrl: string;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  fileName: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  fileSize?: number;

  @ApiProperty({
    type: [String],
    description: 'Tests this file is uploaded for ("Uploaded for")',
  })
  @IsArray()
  @IsString({ each: true })
  testsCovered: string[];
}

export class CreateReportDto {
  @ApiProperty({ description: 'Booking this report belongs to' })
  @IsString()
  bookingId: string;

  @ApiProperty({ enum: FitnessStatus })
  @IsEnum(FitnessStatus)
  fitnessStatus: FitnessStatus;

  @ApiProperty({ type: [ReportFileDto], description: 'Uploaded report files' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReportFileDto)
  files: ReportFileDto[];

  @ApiPropertyOptional({ description: 'Lab internal reference number' })
  @IsString()
  @IsOptional()
  labInternalRef?: string;

  @ApiPropertyOptional({ description: 'Whether the candidate is insured' })
  @IsBoolean()
  @IsOptional()
  isInsure?: boolean;

  @ApiPropertyOptional({ description: 'Approval status toggle' })
  @IsBoolean()
  @IsOptional()
  approvalStatus?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  remarks?: string;
}
