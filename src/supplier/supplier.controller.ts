// src/supplier/supplier.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/types/current-user';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto';
import { CreateSupplierFollowUpDto } from './dto/create-supplier-follow-up.dto';

@ApiTags('租户端-供应商')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.supplierService.create(user, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QuerySupplierDto,
  ) {
    return this.supplierService.findMany(user, query);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.supplierService.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.supplierService.remove(user, id);
  }

  @Post(':id/contacts')
  createContact(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') supplierId: string,
    @Body() dto: CreateSupplierContactDto,
  ) {
    return this.supplierService.createContact(user, supplierId, dto);
  }

  @Patch(':id/contacts/:contactId')
  updateContact(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') supplierId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateSupplierContactDto,
  ) {
    return this.supplierService.updateContact(user, supplierId, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  removeContact(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') supplierId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.supplierService.removeContact(user, supplierId, contactId);
  }

  @Post(':id/follow-ups')
  createFollowUp(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') supplierId: string,
    @Body() dto: CreateSupplierFollowUpDto,
  ) {
    return this.supplierService.createFollowUp(user, supplierId, dto);
  }

  @Get(':id/follow-ups')
  findFollowUps(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') supplierId: string,
  ) {
    return this.supplierService.findFollowUps(user, supplierId);
  }
}
