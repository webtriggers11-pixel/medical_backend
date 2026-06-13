import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('bookings/data')
  @ApiOperation({
    summary: 'Bookings billing data (columns + rows) for the on-screen table',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (ISO YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (ISO YYYY-MM-DD)',
  })
  getBookingsData(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ) {
    return this.exportService.bookingMatrix({ from, to });
  }

  @Get('bookings')
  @ApiOperation({
    summary:
      'Export bookings (billing format) as CSV, filtered by requested date',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (ISO YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (ISO YYYY-MM-DD)',
  })
  async exportBookings(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.bookingsCsv({ from, to });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="medisync-bookings-${stamp}.csv"`,
    );
    res.send(csv);
  }
}
