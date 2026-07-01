// src/purchase-requirement/purchase-requirement.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { PurchaseRequirementService } from './purchase-requirement.service';
import { CreatePurchaseRequirementDto } from './dto/create-purchase-requirement.dto';
import { UpdatePurchaseRequirementDto } from './dto/update-purchase-requirement.dto';
import { QueryPurchaseRequirementDto } from './dto/query-purchase-requirement.dto';
import { CreatePurchaseRequirementFromSalesOrderDto } from './dto/create-purchase-requirement-from-sales-order.dto';
import { ReplacePurchaseRequirementItemsDto } from './dto/replace-purchase-requirement-items.dto';
import { ChangePurchaseRequirementStatusDto } from './dto/change-purchase-requirement-status.dto';
import { UpdateRequirementItemOrderedQuantityDto } from './dto/update-requirement-item-ordered-quantity.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/purchase-requirements')
export class PurchaseRequirementController {
  constructor(private readonly service: PurchaseRequirementService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreatePurchaseRequirementDto,
  ) {
    return this.service.create(user, dto);
  }

  @Post('from-sales-order/:salesOrderId')
  createFromSalesOrder(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('salesOrderId') salesOrderId: string,
    @Body() dto: CreatePurchaseRequirementFromSalesOrderDto,
  ) {
    return this.service.createFromSalesOrder(user, salesOrderId, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryPurchaseRequirementDto,
  ) {
    return this.service.findMany(user, query);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseRequirementDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Put(':id/items')
  replaceItems(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReplacePurchaseRequirementItemsDto,
  ) {
    return this.service.replaceItems(user, id, dto);
  }

  @Patch(':id/items/:itemId/ordered-quantity')
  updateOrderedQuantity(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateRequirementItemOrderedQuantityDto,
  ) {
    return this.service.updateOrderedQuantity(user, id, itemId, dto);
  }

  @Post(':id/status')
  changeStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ChangePurchaseRequirementStatusDto,
  ) {
    return this.service.changeStatus(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
