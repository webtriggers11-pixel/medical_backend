import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { basename, join } from 'path';
import archiver from 'archiver';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { DownloadZipDto } from './dto/download-zip.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { reportFileMulterOptions } from '../../common/storage/report-file.storage';
import { S3Service } from '../../common/storage/s3.service';
import {
  isS3Storage,
  REPORTS_SUBDIR,
  UPLOAD_ROOT,
} from '../../common/storage/storage.constants';

/** Sanitise a path segment for safe use as a ZIP entry name. */
function safeSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'file';
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(
    private reportService: ReportService,
    private s3: S3Service,
  ) {}

  @Post('upload')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload report files (returns file descriptors)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20, reportFileMulterOptions))
  uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('No files uploaded');
    return this.reportService.uploadFiles(files);
  }

  @Get('files/:fileId/url')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({
    summary: 'Get a (pre-signed) download URL for a report file',
  })
  getFileUrl(@Param('fileId') fileId: string, @CurrentUser() user: any) {
    return this.reportService.getFileDownloadUrl(fileId, user);
  }

  @Post('download-zip')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({
    summary:
      'Bulk-download report files as a ZIP — by selected fileIds or the current filter set',
  })
  async downloadZip(
    @Body() dto: DownloadZipDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    if (!dto.fileIds?.length && !dto.filters) {
      throw new BadRequestException('Provide fileIds or filters to download.');
    }
    const files = await this.reportService.resolveZipFiles(dto, user);
    if (!files.length) {
      throw new BadRequestException('No report files match your selection.');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="reports.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => res.destroy(err));
    archive.pipe(res);

    // Group files under a per-candidate folder, de-duplicating entry names so
    // two candidates (or two files) with the same filename never collide.
    const used = new Set<string>();
    const uniqueName = (folder: string, name: string): string => {
      let entry = `${folder}/${name}`;
      if (!used.has(entry)) {
        used.add(entry);
        return entry;
      }
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      let i = 1;
      do {
        entry = `${folder}/${stem} (${i++})${ext}`;
      } while (used.has(entry));
      used.add(entry);
      return entry;
    };

    for (const f of files) {
      const entryName = uniqueName(
        safeSegment(f.candidateLabel),
        safeSegment(f.fileName),
      );
      if (f.fileKey && isS3Storage()) {
        const stream = await this.s3.getObjectStream(f.fileKey);
        archive.append(stream, { name: entryName });
      } else if (f.fileUrl) {
        // Legacy disk driver — resolve the physical path under /uploads/reports.
        const diskPath = join(UPLOAD_ROOT, REPORTS_SUBDIR, basename(f.fileUrl));
        if (existsSync(diskPath)) archive.file(diskPath, { name: entryName });
      }
    }

    await archive.finalize();
  }

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a report for a booking' })
  create(@Body() dto: CreateReportDto, @CurrentUser() user: any) {
    return this.reportService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Update an existing report — metadata and/or files (add/remove/retag) (ADMIN only)',
  })
  update(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.reportService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Delete a report (removes its files, reverts booking) (ADMIN only)',
  })
  remove(@Param('id') id: string) {
    return this.reportService.remove(id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({
    summary: 'List reports (ADMIN: all, USER: own candidates only)',
  })
  findAll(@CurrentUser() user: any) {
    return this.reportService.findAllForUser(user);
  }

  @Get('candidate/:candidateId')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Get all reports for a candidate' })
  findByCandidate(
    @Param('candidateId') candidateId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportService.findByCandidate(candidateId, { page, limit });
  }

  @Get('booking/:bookingId')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Get report for a specific booking' })
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.reportService.findByBooking(bookingId);
  }
}
