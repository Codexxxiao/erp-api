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
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { MetadataService } from './metadata.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { CreateFormTableDto } from './dto/create-form-table.dto';
import { UpdateFormTableDto } from './dto/update-form-table.dto';
import { CreateFormFieldDto } from './dto/create-form-field.dto';
import { UpdateFormFieldDto } from './dto/update-form-field.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/forms')
export class TenantMetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateFormDto,
  ) {
    return this.metadataService.createTenantForm(user, dto);
  }

  @Get()
  findTenantForms(@CurrentUserDecorator() user: CurrentUser) {
    return this.metadataService.findTenantForms(user);
  }

  @Get('available')
  findAvailableForms(@CurrentUserDecorator() user: CurrentUser) {
    return this.metadataService.findAvailableForms(user);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.metadataService.findOneForTenant(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateFormDto,
  ) {
    return this.metadataService.updateForm(id, dto, user);
  }

  @Patch(':id/enable')
  enable(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.metadataService.enableForm(id, user);
  }

  @Patch(':id/disable')
  disable(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.metadataService.disableForm(id, user);
  }

  @Post(':id/tables')
  createTable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreateFormTableDto,
  ) {
    return this.metadataService.createTable(id, dto, user);
  }

  @Patch('tables/:tableId')
  updateTable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('tableId') tableId: string,
    @Body() dto: UpdateFormTableDto,
  ) {
    return this.metadataService.updateTable(tableId, dto, user);
  }

  @Post('tables/:tableId/fields')
  createField(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('tableId') tableId: string,
    @Body() dto: CreateFormFieldDto,
  ) {
    return this.metadataService.createField(tableId, dto, user);
  }

  @Patch('fields/:fieldId')
  updateField(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFormFieldDto,
  ) {
    return this.metadataService.updateField(fieldId, dto, user);
  }
}
