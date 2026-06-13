import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Stats')
@Controller('stats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({
    summary: 'Project stats — global for ADMIN, scoped to own data for clients',
  })
  @ApiResponse({ status: 200, description: 'Stats summary' })
  getStats(@CurrentUser() user: { id: string; role: string }) {
    return user.role === 'ADMIN'
      ? this.statsService.adminStats()
      : this.statsService.clientStats(user.id);
  }
}
