import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ZoneStatus } from '@prisma/client';

export class UpdateZoneDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: ZoneStatus })
  @IsEnum(ZoneStatus)
  @IsOptional()
  status?: ZoneStatus;
}
