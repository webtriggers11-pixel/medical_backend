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
import { ZoneService } from './zone.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Zones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('zones')
export class ZoneController {
  constructor(private zoneService: ZoneService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a zone for a company' })
  create(@Body() dto: CreateZoneDto, @CurrentUser() user: any) {
    return this.zoneService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List zones for a company' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string, @CurrentUser() user: any) {
    return this.zoneService.findAll(companyId, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a zone' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto,
    @CurrentUser() user: any,
  ) {
    return this.zoneService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a zone (fails if active cities exist)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.zoneService.remove(id, user);
  }
}
