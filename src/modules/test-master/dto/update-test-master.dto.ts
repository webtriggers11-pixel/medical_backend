import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TestMasterStatus } from '@prisma/client';

export class UpdateTestMasterDto {
  @ApiPropertyOptional({ example: 'Complete Blood Count' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ enum: TestMasterStatus })
  @IsEnum(TestMasterStatus)
  @IsOptional()
  status?: TestMasterStatus;
}
