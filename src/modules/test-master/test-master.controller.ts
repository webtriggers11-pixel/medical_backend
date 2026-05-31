import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { TestMasterService } from './test-master.service';
import { CreateTestMasterDto } from './dto/create-test-master.dto';
import { UpdateTestMasterDto } from './dto/update-test-master.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Test Masters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('test-masters')
export class TestMasterController {
  constructor(private testMasterService: TestMasterService) {}

  @Get()
  @ApiOperation({ summary: 'List all test master records (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'List of tests' })
  findAll() {
    return this.testMasterService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a test master record (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Test created' })
  @ApiResponse({ status: 409, description: 'Name already exists' })
  create(@Body() dto: CreateTestMasterDto, @CurrentUser() user: any) {
    return this.testMasterService.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a test master record (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Test updated' })
  @ApiResponse({ status: 404, description: 'Test not found' })
  update(@Param('id') id: string, @Body() dto: UpdateTestMasterDto) {
    return this.testMasterService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a test master record (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Test deleted' })
  @ApiResponse({ status: 404, description: 'Test not found' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.testMasterService.softDelete(id, user.id);
  }
}
