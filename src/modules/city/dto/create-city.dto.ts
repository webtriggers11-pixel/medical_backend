import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCityDto {
  @ApiProperty()
  @IsString()
  companyId: string;

  @ApiProperty()
  @IsString()
  zoneId: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;
}
