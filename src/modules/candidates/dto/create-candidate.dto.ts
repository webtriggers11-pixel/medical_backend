import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CandidateType, Gender } from '../../../common/enums/candidate.enums';

export class CreateCandidateDto {
  @ApiPropertyOptional({ example: 'East' })
  @IsString()
  @IsOptional()
  zone?: string;

  @ApiPropertyOptional({ example: 'Guwahati' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Semolina Kitchens Pvt. Ltd.' })
  @IsString()
  @IsOptional()
  store?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'EMP1234' })
  @IsString()
  @IsNotEmpty()
  employeeCode: string;

  @ApiProperty({ example: '9999999999' })
  @Matches(/^\d{10}$/, { message: 'mobileNumber must be exactly 10 digits' })
  mobileNumber: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender, { message: 'gender must be MALE, FEMALE or OTHER' })
  gender: Gender;

  @ApiProperty({ example: 20, minimum: 18, maximum: 100 })
  @Type(() => Number)
  @IsInt({ message: 'age must be a whole number' })
  @Min(18, { message: 'age must be at least 18' })
  @Max(100, { message: 'age must be 100 or less' })
  age: number;

  @ApiProperty({ enum: CandidateType, example: CandidateType.EXISTING })
  @IsEnum(CandidateType, { message: 'candidateType must be EXISTING or NEW' })
  candidateType: CandidateType;

  @ApiProperty({ example: '2026-05-22', description: 'ISO date (YYYY-MM-DD)' })
  @IsISO8601({}, { message: 'dateOfJoining must be a valid date' })
  dateOfJoining: string;

  @ApiPropertyOptional({ example: '781001' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'pincode must be exactly 6 digits' })
  pincode?: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: 'panNumber must be a valid PAN (e.g. ABCDE1234F)',
  })
  panNumber?: string;
}
