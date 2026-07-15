import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

/**
 * Filter set mirroring the client Reports page — used when downloading "all
 * filtered" reports as a ZIP (no explicit selection). Server re-resolves the
 * matching candidates (scoped to the caller) and bundles their report files.
 */
export class DownloadZipFiltersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: 'ACTIVE | INACTIVE' })
  @IsOptional()
  @IsString()
  storeStatus?: string;

  @ApiPropertyOptional({
    description: 'Schedule-status bucket: SCHEDULE | DONE',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Lower bound (ISO) for report uploaded date',
  })
  @IsOptional()
  @IsString()
  uploadFrom?: string;

  @ApiPropertyOptional({
    description: 'Upper bound (ISO) for report uploaded date',
  })
  @IsOptional()
  @IsString()
  uploadTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Bulk ZIP download request. Provide EITHER `fileIds` (explicit row selection)
 * OR `filters` (download every report file matching the current filter set).
 */
export class DownloadZipDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileIds?: string[];

  @ApiPropertyOptional({ type: DownloadZipFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DownloadZipFiltersDto)
  filters?: DownloadZipFiltersDto;
}
