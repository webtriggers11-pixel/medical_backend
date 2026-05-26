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
import { CityService } from './city.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Cities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cities')
export class CityController {
  constructor(private cityService: CityService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a city under a zone' })
  create(@Body() dto: CreateCityDto, @CurrentUser() user: any) {
    return this.cityService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'List cities for a zone' })
  @ApiQuery({ name: 'zoneId', required: true })
  findAll(@Query('zoneId') zoneId: string) {
    return this.cityService.findAll(zoneId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a city' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCityDto,
    @CurrentUser() user: any,
  ) {
    return this.cityService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a city (fails if active stores exist)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.cityService.remove(id, user);
  }
}
