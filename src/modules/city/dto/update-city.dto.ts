import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { CityStatus } from '@prisma/client';

export class UpdateCityDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: CityStatus })
  @IsEnum(CityStatus)
  @IsOptional()
  status?: CityStatus;
}
