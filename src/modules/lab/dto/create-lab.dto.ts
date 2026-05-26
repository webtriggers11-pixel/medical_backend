import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator';

export class CreateLabDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  contactName: string;

  @ApiProperty()
  @IsString()
  contactMobile: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ type: [String], description: 'List of city IDs this lab serves' })
  @IsArray()
  @IsOptional()
  serviceCities?: string[];
}
