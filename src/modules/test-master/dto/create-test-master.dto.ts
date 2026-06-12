import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TestMasterStatus } from '@prisma/client';

export class CreateTestMasterDto {
  @ApiProperty({ example: 'Complete Blood Count' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Measures red/white blood cells and platelets',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    enum: TestMasterStatus,
    default: TestMasterStatus.ACTIVE,
  })
  @IsEnum(TestMasterStatus)
  @IsOptional()
  status?: TestMasterStatus;
}
