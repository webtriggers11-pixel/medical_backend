import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { FitnessStatus } from '@prisma/client';

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
}
