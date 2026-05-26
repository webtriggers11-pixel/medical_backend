import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { CheckupFrequency, CompanyStatus } from '@prisma/client';

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  industryType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  gstNumber?: string;

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
  billingEmail?: string;

  @ApiPropertyOptional({ enum: CheckupFrequency })
  @IsEnum(CheckupFrequency)
  @IsOptional()
  checkupFrequency?: CheckupFrequency;

  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsEnum(CompanyStatus)
  @IsOptional()
  status?: CompanyStatus;
}
