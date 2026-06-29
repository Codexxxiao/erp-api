import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { DatasourceService } from './datasource.service';
import { CreateDataSourceDto } from './dto/create-datasource.dto';
import { UpdateDataSourceDto } from './dto/update-datasource.dto';
import { CreateDataSourceFieldDto } from './dto/create-datasource-field.dto';
import { UpdateDataSourceFieldDto } from './dto/update-datasource-field.dto';

@Controller('admin/datasources')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminDatasourceController {
  constructor(private readonly datasources: DatasourceService) {}

  @Post()
  create(@Body() dto: CreateDataSourceDto) {
    return this.datasources.createSystemDataSource(dto);
  }

  @Get()
  findMany() {
    return this.datasources.findSystemDataSources();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDataSourceDto) {
    return this.datasources.updateSystemDataSource(id, dto);
  }

  @Post(':id/fields')
  createField(@Param('id') id: string, @Body() dto: CreateDataSourceFieldDto) {
    return this.datasources.createSystemField(id, dto);
  }

  @Patch('fields/:fieldId')
  updateField(
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateDataSourceFieldDto,
  ) {
    return this.datasources.updateSystemField(fieldId, dto);
  }
}
