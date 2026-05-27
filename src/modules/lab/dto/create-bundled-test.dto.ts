import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBundledTestDto {
  @ApiProperty()
  @IsString()
  labId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ type: [String], description: 'List of individual test names e.g. ["CBC", "X-Ray", "UA"]' })
  @IsArray()
  @IsString({ each: true })
  testsIncluded: string[];

  @ApiPropertyOptional({ description: 'e.g. "24 hours", "Same day"' })
  @IsString()
  @IsOptional()
  defaultTiming?: string;

  @ApiProperty({ description: 'Suggested MRP in INR' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  suggestedMrp: number;
}
