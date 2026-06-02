import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FitnessStatus } from '@prisma/client';
import { ReportFileDto } from './create-report.dto';

/** Update the "Uploaded for" tests on an existing report file. */
export class UpdateReportFileDto {
  @ApiPropertyOptional({ description: 'Existing report-file id' })
  @IsString()
  id: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  testsCovered: string[];
}

export class UpdateReportDto {
  @ApiPropertyOptional({ enum: FitnessStatus })
  @IsEnum(FitnessStatus)
  @IsOptional()
  fitnessStatus?: FitnessStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  labInternalRef?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isInsure?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  approvalStatus?: boolean;

  // ── file operations ───────────────────────────────────────────
  @ApiPropertyOptional({
    type: [ReportFileDto],
    description: 'New files to attach (already uploaded via /reports/upload)',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReportFileDto)
  addFiles?: ReportFileDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Ids of existing report files to remove',
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  removeFileIds?: string[];

  @ApiPropertyOptional({
    type: [UpdateReportFileDto],
    description: 'Update the "Uploaded for" tests on existing files',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateReportFileDto)
  fileUpdates?: UpdateReportFileDto[];
}
