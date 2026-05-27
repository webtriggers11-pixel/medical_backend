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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PanelService } from './panel.service';
import { CreatePanelDto } from './dto/create-panel.dto';
import { UpdatePanelDto } from './dto/update-panel.dto';
import { SetCompanyPricingDto } from './dto/set-company-pricing.dto';
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
  @ApiOperation({ summary: 'Create a panel (links a bundled test to a lab with pricing)' })
  create(@Body() dto: CreatePanelDto, @CurrentUser() user: any) {
    return this.panelService.create(dto, user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List panels with optional filters' })
  @ApiQuery({ name: 'labId', required: false })
  findAll(@Query('labId') labId?: string) {
    return this.panelService.findAll({ labId });
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get a panel with all company pricing' })
  findOne(@Param('id') id: string) {
    return this.panelService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update panel details (mrp, costToVendor, status, etc.)' })
  update(@Param('id') id: string, @Body() dto: UpdatePanelDto) {
    return this.panelService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a panel' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.panelService.remove(id, user.id);
  }

  // ── Company pricing endpoints ────────────────────────────────

  @Post(':id/pricing')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set or update company-specific pricing for a panel' })
  setCompanyPricing(
    @Param('id') panelId: string,
    @Body() dto: SetCompanyPricingDto,
    @CurrentUser() user: any,
  ) {
    return this.panelService.setCompanyPricing(panelId, dto, user.id);
  }

  @Get(':id/pricing')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all company pricing for a panel' })
  getCompanyPricing(@Param('id') panelId: string) {
    return this.panelService.getCompanyPricing(panelId);
  }

  @Delete(':id/pricing/:companyId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remove company-specific pricing for a panel' })
  removeCompanyPricing(
    @Param('id') panelId: string,
    @Param('companyId') companyId: string,
    @CurrentUser() user: any,
  ) {
    return this.panelService.removeCompanyPricing(panelId, companyId, user.id);
  }
}
