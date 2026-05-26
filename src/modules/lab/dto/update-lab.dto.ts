import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray, IsEnum } from 'class-validator';
import { LabStatus } from '@prisma/client';

export class UpdateLabDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactMobile?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  serviceCities?: string[];

  @ApiPropertyOptional({ enum: LabStatus })
  @IsEnum(LabStatus)
  @IsOptional()
  status?: LabStatus;
}
