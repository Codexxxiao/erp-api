import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantAdminGuard } from '../common/guards/tenant-admin.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { DatasourceService, type DataSourceOption } from './datasource.service';
import { CreateDataSourceDto } from './dto/create-datasource.dto';
import { UpdateDataSourceDto } from './dto/update-datasource.dto';
import { CreateDataSourceFieldDto } from './dto/create-datasource-field.dto';
import { UpdateDataSourceFieldDto } from './dto/update-datasource-field.dto';
import { QueryDataSourceDto } from './dto/query-datasource.dto';

@Controller('tenant/datasources')
export class TenantDatasourceController {
  constructor(private readonly datasources: DatasourceService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  findTenantDataSources(@CurrentUserDecorator() user: CurrentUser) {
    return this.datasources.findTenantDataSources(user);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
  findAvailable(@CurrentUserDecorator() user: CurrentUser) {
    return this.datasources.findAvailableDataSources(user);
  }

  @Get('code/:code/fields')
  @UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
  fields(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('code') code: string,
  ) {
    return this.datasources.getEffectiveFields(user, code);
  }

  @Get('code/:code/query')
  @UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
  queryDataSource(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('code') code: string,
    @Query() query: QueryDataSourceDto,
  ): Promise<DataSourceOption[]> {
    return this.datasources.query(user, code, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateDataSourceDto,
  ) {
    return this.datasources.createTenantDataSource(user, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateDataSourceDto,
  ) {
    return this.datasources.updateTenantDataSource(user, id, dto);
  }

  @Post(':id/fields')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  createField(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreateDataSourceFieldDto,
  ) {
    return this.datasources.createTenantField(user, id, dto);
  }

  @Patch('fields/:fieldId')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  updateField(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateDataSourceFieldDto,
  ) {
    return this.datasources.updateTenantField(user, fieldId, dto);
  }
}
