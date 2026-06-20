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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PanelService } from './panel.service';
import { CreatePanelDto } from './dto/create-panel.dto';
import { UpdatePanelDto } from './dto/update-panel.dto';
import { SetClientPricingDto } from './dto/set-client-pricing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Panels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('panels')
export class PanelController {
  constructor(private panelService: PanelService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a panel (links a bundled test to a lab with pricing)',
  })
  create(@Body() dto: CreatePanelDto, @CurrentUser() user: any) {
    return this.panelService.create(dto, user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List panels with optional filters' })
  @ApiQuery({ name: 'labId', required: false })
  findAll(
    @Query('labId') labId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
  ) {
    return this.panelService.findAll(
      { labId, clientId, search },
      { page, limit },
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get a panel with all client pricing' })
  findOne(@Param('id') id: string) {
    return this.panelService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Update panel details (mrp, costToVendor, status, etc.)',
  })
  update(@Param('id') id: string, @Body() dto: UpdatePanelDto) {
    return this.panelService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a panel' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.panelService.remove(id, user.id);
  }

  // ── Client pricing endpoints ─────────────────────────────────

  @Post(':id/pricing')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set or update client-specific pricing for a panel',
  })
  setClientPricing(
    @Param('id') panelId: string,
    @Body() dto: SetClientPricingDto,
    @CurrentUser() user: any,
  ) {
    return this.panelService.setClientPricing(panelId, dto, user.id);
  }

  @Get(':id/pricing')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all client pricing for a panel' })
  getClientPricing(
    @Param('id') panelId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.panelService.getClientPricing(panelId, { page, limit });
  }

  @Delete(':id/pricing/:clientId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remove client-specific pricing for a panel' })
  removeClientPricing(
    @Param('id') panelId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: any,
  ) {
    return this.panelService.removeClientPricing(panelId, clientId, user.id);
  }
}
