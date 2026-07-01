// src/inventory/inventory.controller.ts
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
import { InventoryService } from './inventory.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { QueryWarehouseDto } from './dto/query-warehouse.dto';
import { QueryInventoryBalanceDto } from './dto/query-inventory-balance.dto';
import { QueryInventoryTransactionDto } from './dto/query-inventory-transaction.dto';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { UpdateInventoryAdjustmentDto } from './dto/update-inventory-adjustment.dto';
import { QueryInventoryAdjustmentDto } from './dto/query-inventory-adjustment.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post('warehouses')
  createWarehouse(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.service.createWarehouse(user, dto);
  }

  @Get('warehouses')
  findWarehouses(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryWarehouseDto,
  ) {
    return this.service.findWarehouses(user, query);
  }

  @Get('warehouses/:id')
  findWarehouse(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.findWarehouse(user, id);
  }

  @Patch('warehouses/:id')
  updateWarehouse(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.service.updateWarehouse(user, id, dto);
  }

  @Delete('warehouses/:id')
  removeWarehouse(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.removeWarehouse(user, id);
  }

  @Get('balances')
  findBalances(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryInventoryBalanceDto,
  ) {
    return this.service.findBalances(user, query);
  }

  @Get('transactions')
  findTransactions(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryInventoryTransactionDto,
  ) {
    return this.service.findTransactions(user, query);
  }

  @Post('adjustments')
  createAdjustment(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateInventoryAdjustmentDto,
  ) {
    return this.service.createAdjustment(user, dto);
  }

  @Get('adjustments')
  findAdjustments(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryInventoryAdjustmentDto,
  ) {
    return this.service.findAdjustments(user, query);
  }

  @Get('adjustments/:id')
  findAdjustment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.findAdjustment(user, id);
  }

  @Patch('adjustments/:id')
  updateAdjustment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryAdjustmentDto,
  ) {
    return this.service.updateAdjustment(user, id, dto);
  }

  @Post('adjustments/:id/confirm')
  confirmAdjustment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.confirmAdjustment(user, id);
  }

  @Post('adjustments/:id/cancel')
  cancelAdjustment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelAdjustment(user, id);
  }
}
