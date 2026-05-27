import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class CreateStoreDto {
  @ApiProperty()
  @IsString()
  cityId: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  storeCode: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  storeHeadName: string;

  @ApiProperty()
  @IsString()
  storeHeadMobile: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  storeContact?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  storeAsstHeadName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  storeAsstHeadMobile?: string;
}
