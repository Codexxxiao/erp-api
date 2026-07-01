// src/purchase-order/purchase-order.controller.ts
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
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { QueryPurchaseOrderDto } from './dto/query-purchase-order.dto';
import { CreatePurchaseOrderFromRequirementsDto } from './dto/create-purchase-order-from-requirements.dto';
import { ChangePurchaseOrderStatusDto } from './dto/change-purchase-order-status.dto';
import { UpdatePurchaseOrderItemReceivedQuantityDto } from './dto/update-purchase-order-item-received-quantity.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly service: PurchaseOrderService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.service.create(user, dto);
  }

  @Post('from-requirements')
  createFromRequirements(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreatePurchaseOrderFromRequirementsDto,
  ) {
    return this.service.createFromRequirements(user, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryPurchaseOrderDto,
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
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Post(':id/status')
  changeStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ChangePurchaseOrderStatusDto,
  ) {
    return this.service.changeStatus(user, id, dto);
  }

  @Patch(':id/items/:itemId/received-quantity')
  updateReceivedQuantity(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePurchaseOrderItemReceivedQuantityDto,
  ) {
    return this.service.updateReceivedQuantity(user, id, itemId, dto);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
