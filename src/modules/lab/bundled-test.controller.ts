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
import { BundledTestService } from './bundled-test.service';
import { CreateBundledTestDto } from './dto/create-bundled-test.dto';
import { UpdateBundledTestDto } from './dto/update-bundled-test.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Lab Bundled Tests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lab-bundled-tests')
export class BundledTestController {
  constructor(private bundledTestService: BundledTestService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a bundled test for a lab (e.g. "Pre-employment Basic" = CBC + X-Ray + UA)' })
  create(@Body() dto: CreateBundledTestDto, @CurrentUser() user: any) {
    return this.bundledTestService.create(dto, user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List bundled tests for a lab' })
  @ApiQuery({ name: 'labId', required: true })
  findAll(@Query('labId') labId: string) {
    return this.bundledTestService.findAll(labId);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get a bundled test with its panels' })
  findOne(@Param('id') id: string) {
    return this.bundledTestService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a bundled test' })
  update(@Param('id') id: string, @Body() dto: UpdateBundledTestDto) {
    return this.bundledTestService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a bundled test' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bundledTestService.remove(id, user.id);
  }
}
