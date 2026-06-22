import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CandidatesService } from './candidates.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { BulkDeleteCandidatesDto } from './dto/bulk-delete-candidates.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

/** Minimal shape of an uploaded file (avoids depending on @types/multer). */
interface UploadedCsv {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('Candidates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.USER)
@Controller('candidates')
export class CandidatesController {
  constructor(private candidatesService: CandidatesService) {}

  @Get()
  @ApiOperation({
    summary: 'List candidates (scoped to own client for USER role)',
  })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({
    name: 'available',
    required: false,
    description:
      'When true, only "requested" candidates (active, with an appointment, not yet booked)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Free-text search across name / employee code / email / mobile',
  })
  @ApiResponse({ status: 200, description: 'List of candidates' })
  findAll(
    @CurrentUser() user: any,
    @Query('clientId') clientId?: string,
    @Query('storeId') storeId?: string,
    @Query('available') available?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('with') withParam?: string,
    @Query('zoneId') zoneId?: string,
    @Query('cityId') cityId?: string,
    @Query('labId') labId?: string,
    @Query('approve') approve?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const rel = (withParam ?? '').split(',').map((s) => s.trim());
    return this.candidatesService.findAll(
      user,
      {
        clientId,
        storeId,
        zoneId,
        cityId,
        labId,
        isApproved:
          approve === 'true' ? true : approve === 'false' ? false : undefined,
        statusBucket: status,
        appointmentFrom: from,
        appointmentTo: to,
        availableForBooking: available === 'true',
        search,
        candidateType: type,
      },
      { page, limit },
      { booking: rel.includes('booking'), reports: rel.includes('reports') },
    );
  }

  @Get('type-counts')
  @ApiOperation({ summary: 'Candidate counts by type (scoped to caller)' })
  typeCounts(@CurrentUser() user: any) {
    return this.candidatesService.typeCounts(user);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new candidate' })
  @ApiResponse({ status: 201, description: 'Candidate created' })
  create(@Body() dto: CreateCandidateDto, @CurrentUser() user: any) {
    return this.candidatesService.create(dto, user?.id);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Toggle candidate approval status' })
  setApproval(
    @Param('id') id: string,
    @Body('isApproved') isApproved: boolean,
  ) {
    return this.candidatesService.setApproval(id, isApproved);
  }

  @Post('bulk-delete')
  @ApiOperation({
    summary:
      'Soft-delete many candidates (cascades to their bookings & reports)',
  })
  @ApiResponse({ status: 201, description: '{ deleted, skipped }' })
  bulkDelete(@Body() dto: BulkDeleteCandidatesDto, @CurrentUser() user: any) {
    return this.candidatesService.bulkSoftDelete(user, dto.ids);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a candidate (admin only)' })
  @ApiResponse({ status: 200, description: 'Updated candidate' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCandidateDto,
    @CurrentUser() user: any,
  ) {
    return this.candidatesService.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete a candidate (cascades to bookings & reports)',
  })
  @ApiResponse({ status: 200, description: 'Soft-deleted candidate id' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.candidatesService.softDelete(user, id);
  }

  @Get('template')
  @ApiOperation({ summary: 'Download the bulk-upload CSV template' })
  async getTemplate(@CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.candidatesService.getTemplate(user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="candidate-bulk-upload-template.csv"',
    );
    res.send(csv);
  }

  @Post('bulk')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Bulk upload candidates from a CSV file' })
  @ApiResponse({ status: 201, description: 'Bulk upload result summary' })
  bulkUpload(@UploadedFile() file: UploadedCsv, @CurrentUser() user: any) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Field name must be "file".',
      );
    }
    const name = file.originalname?.toLowerCase() ?? '';
    if (!name.endsWith('.csv') && !file.mimetype?.includes('csv')) {
      throw new BadRequestException('Only .csv files are supported.');
    }
    return this.candidatesService.bulkCreate(
      file.buffer.toString('utf-8'),
      user,
    );
  }
}
