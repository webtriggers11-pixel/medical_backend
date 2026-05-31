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
import { LabService } from './lab.service';
import { CreateLabDto } from './dto/create-lab.dto';
import { UpdateLabDto } from './dto/update-lab.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Labs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('labs')
export class LabController {
  constructor(private labService: LabService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a lab' })
  create(@Body() dto: CreateLabDto, @CurrentUser() user: any) {
    return this.labService.create(dto, user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all labs, optionally filtered by cityId' })
  @ApiQuery({ name: 'cityId', required: false })
  findAll(
    @Query('cityId') cityId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.labService.findAll(cityId, { page, limit });
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get a lab with its panels' })
  findOne(@Param('id') id: string) {
    return this.labService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a lab' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLabDto,
    @CurrentUser() user: any,
  ) {
    return this.labService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a lab' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.labService.remove(id, user.id);
  }
}
