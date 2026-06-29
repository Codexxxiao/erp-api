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
import { MetadataService } from './metadata.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { CreateFormTableDto } from './dto/create-form-table.dto';
import { UpdateFormTableDto } from './dto/update-form-table.dto';
import { CreateFormFieldDto } from './dto/create-form-field.dto';
import { UpdateFormFieldDto } from './dto/update-form-field.dto';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/forms')
export class AdminMetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Post()
  create(@Body() dto: CreateFormDto) {
    return this.metadataService.createSystemForm(dto);
  }

  @Get()
  findAll() {
    return this.metadataService.findSystemForms();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.metadataService.updateForm(id, dto);
  }

  @Patch(':id/enable')
  enable(@Param('id') id: string) {
    return this.metadataService.enableForm(id);
  }

  @Patch(':id/disable')
  disable(@Param('id') id: string) {
    return this.metadataService.disableForm(id);
  }

  @Post(':id/tables')
  createTable(@Param('id') id: string, @Body() dto: CreateFormTableDto) {
    return this.metadataService.createTable(id, dto);
  }

  @Patch('tables/:tableId')
  updateTable(
    @Param('tableId') tableId: string,
    @Body() dto: UpdateFormTableDto,
  ) {
    return this.metadataService.updateTable(tableId, dto);
  }

  @Post('tables/:tableId/fields')
  createField(
    @Param('tableId') tableId: string,
    @Body() dto: CreateFormFieldDto,
  ) {
    return this.metadataService.createField(tableId, dto);
  }

  @Patch('fields/:fieldId')
  updateField(
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFormFieldDto,
  ) {
    return this.metadataService.updateField(fieldId, dto);
  }
}
