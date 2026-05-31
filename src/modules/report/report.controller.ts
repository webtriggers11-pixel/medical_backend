import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { reportFileMulterOptions } from '../../common/storage/report-file.storage';
import { REPORTS_PUBLIC_PREFIX } from '../../common/storage/storage.constants';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Post('upload')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload report files (returns file descriptors)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20, reportFileMulterOptions))
  uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('No files uploaded');
    return files.map((f) => ({
      fileUrl: `${REPORTS_PUBLIC_PREFIX}/${f.filename}`,
      fileName: f.originalname,
      fileSize: f.size,
    }));
  }

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a report for a booking' })
  create(@Body() dto: CreateReportDto, @CurrentUser() user: any) {
    return this.reportService.create(dto, user.id);
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
