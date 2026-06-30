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
import { CreateListViewDto } from './dto/create-list-view.dto';
import { UpdateListViewDto } from './dto/update-list-view.dto';
import { QueryListViewDto } from './dto/query-list-view.dto';
import { ListViewService } from './list-view.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/list-views')
export class ListViewController {
  constructor(private readonly listViewService: ListViewService) {}

  @UseGuards(TenantAdminGuard)
  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateListViewDto,
  ) {
    return this.listViewService.create(user, dto);
  }

  @Get()
  findAll(
    @CurrentUserDecorator() user: CurrentUser,
    @Query('formId') formId?: string,
  ) {
    return this.listViewService.findAll(user, formId);
  }

  @Get('form/:formId/default')
  findDefault(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('formId') formId: string,
  ) {
    return this.listViewService.findDefault(user, formId);
  }

  @Post(':id/query')
  queryView(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: QueryListViewDto,
  ) {
    return this.listViewService.queryView(user, id, dto);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.listViewService.findOne(user, id);
  }

  @UseGuards(TenantAdminGuard)
  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateListViewDto,
  ) {
    return this.listViewService.update(user, id, dto);
  }

  @UseGuards(TenantAdminGuard)
  @Patch(':id/enable')
  enable(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.listViewService.enable(user, id);
  }

  @UseGuards(TenantAdminGuard)
  @Patch(':id/disable')
  disable(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.listViewService.disable(user, id);
  }
}
