import {
  Controller,
  Get,
  Post,
  Body,
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
} from '@nestjs/swagger';
import { CandidatesService } from './candidates.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
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
  @ApiOperation({ summary: 'List all candidates' })
  @ApiResponse({ status: 200, description: 'List of candidates' })
  findAll() {
    return this.candidatesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Add a new candidate' })
  @ApiResponse({ status: 201, description: 'Candidate created' })
  create(@Body() dto: CreateCandidateDto, @CurrentUser() user: any) {
    return this.candidatesService.create(dto, user?.id);
  }

  @Get('template')
  @ApiOperation({ summary: 'Download the bulk-upload CSV template' })
  getTemplate(@Res() res: Response) {
    const csv = this.candidatesService.getTemplate();
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
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Bulk upload candidates from a CSV file' })
  @ApiResponse({ status: 201, description: 'Bulk upload result summary' })
  bulkUpload(@UploadedFile() file: UploadedCsv, @CurrentUser() user: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Field name must be "file".');
    }
    const name = file.originalname?.toLowerCase() ?? '';
    if (!name.endsWith('.csv') && !file.mimetype?.includes('csv')) {
      throw new BadRequestException('Only .csv files are supported.');
    }
    return this.candidatesService.bulkCreate(file.buffer.toString('utf-8'), user?.id);
  }
}
