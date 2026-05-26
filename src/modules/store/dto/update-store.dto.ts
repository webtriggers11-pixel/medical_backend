import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { StoreStatus } from '@prisma/client';

export class UpdateStoreDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  storeHeadName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  storeHeadMobile?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ enum: StoreStatus })
  @IsEnum(StoreStatus)
  @IsOptional()
  status?: StoreStatus;
}
