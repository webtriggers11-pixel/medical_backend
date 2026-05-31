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
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stores')
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a store under a city (owned by the logged-in client)',
  })
  create(@Body() dto: CreateStoreDto, @CurrentUser() user: any) {
    return this.storeService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({
    summary: "List the client's stores (optionally filtered by zone/city)",
  })
  @ApiQuery({ name: 'cityId', required: false })
  @ApiQuery({ name: 'zoneId', required: false })
  findAll(
    @CurrentUser() user: any,
    @Query('cityId') cityId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storeService.findAll(user, { cityId, zoneId }, { page, limit });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Get a store by ID (owner or admin)' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.storeService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a store (admin only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
    @CurrentUser() user: any,
  ) {
    return this.storeService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a store' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.storeService.remove(id, user);
  }
}
