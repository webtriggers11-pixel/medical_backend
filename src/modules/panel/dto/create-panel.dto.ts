import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePanelDto {
  @ApiProperty()
  @IsString()
  labId: string;

  /* BUNDLED TEST — replaced by testMasterIds
  @ApiProperty()
  @IsString()
  bundledTestId: string;
  */

  @ApiProperty({ type: [String], description: 'One or more TestMaster IDs to link to this panel' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  testMasterIds: string[];

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'e.g. "Same day", "24 hours"' })
  @IsString()
  @IsOptional()
  timing?: string;

  @ApiProperty({ description: 'MRP shown to candidates (INR)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  mrp: number;

  @ApiProperty({ description: 'What the platform pays the lab (INR)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  costToVendor: number;

  @ApiPropertyOptional({ description: 'Lab contact person for this panel' })
  @IsString()
  @IsOptional()
  labContact?: string;
}
