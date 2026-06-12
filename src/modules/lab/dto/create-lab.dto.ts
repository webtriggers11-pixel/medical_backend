import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateLabDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  contactName: string;

  @ApiProperty()
  @Matches(/^\d{10}$/, { message: 'contactMobile must be exactly 10 digits' })
  contactMobile: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty()
  @Matches(/^\d{6}$/, { message: 'pincode must be exactly 6 digits' })
  pincode: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'List of city IDs this lab serves',
  })
  @IsArray()
  @IsOptional()
  serviceCities?: string[];
}
