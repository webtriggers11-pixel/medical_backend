import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum, MinLength } from 'class-validator';
import { CheckupFrequency } from '@prisma/client';

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty()
  @IsString()
  industryType: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  gstNumber?: string;

  @ApiProperty()
  @IsString()
  contactName: string;

  @ApiProperty()
  @IsString()
  contactMobile: string;

  @ApiProperty()
  @IsEmail()
  billingEmail: string;

  @ApiProperty({ enum: CheckupFrequency })
  @IsEnum(CheckupFrequency)
  checkupFrequency: CheckupFrequency;
}
