import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PanelStatus } from '@prisma/client';

export class UpdatePanelDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  timing?: string;

  @ApiPropertyOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  mrp?: number;

  @ApiPropertyOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  costToVendor?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  labContact?: string;

  @ApiPropertyOptional({ enum: PanelStatus })
  @IsEnum(PanelStatus)
  @IsOptional()
  status?: PanelStatus;
}
