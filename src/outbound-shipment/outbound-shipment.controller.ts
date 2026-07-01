// src/outbound-shipment/outbound-shipment.controller.ts
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
import { OutboundShipmentService } from './outbound-shipment.service';
import { CreateOutboundShipmentDto } from './dto/create-outbound-shipment.dto';
import { UpdateOutboundShipmentDto } from './dto/update-outbound-shipment.dto';
import { QueryOutboundShipmentDto } from './dto/query-outbound-shipment.dto';
import { ReplaceOutboundShipmentItemsDto } from './dto/replace-outbound-shipment-items.dto';
import { CreateOutboundShipmentFromSalesOrderDto } from './dto/create-outbound-shipment-from-sales-order.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/outbound-shipments')
export class OutboundShipmentController {
  constructor(private readonly service: OutboundShipmentService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateOutboundShipmentDto,
  ) {
    return this.service.create(user, dto);
  }

  @Post('from-sales-order/:salesOrderId')
  createFromSalesOrder(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('salesOrderId') salesOrderId: string,
    @Body() dto: CreateOutboundShipmentFromSalesOrderDto,
  ) {
    return this.service.createFromSalesOrder(user, salesOrderId, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryOutboundShipmentDto,
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
    @Body() dto: UpdateOutboundShipmentDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Put(':id/items')
  replaceItems(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReplaceOutboundShipmentItemsDto,
  ) {
    return this.service.replaceItems(user, id, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.confirm(user, id);
  }

  @Post(':id/mark-shipped')
  markShipped(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.markShipped(user, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.cancel(user, id);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
