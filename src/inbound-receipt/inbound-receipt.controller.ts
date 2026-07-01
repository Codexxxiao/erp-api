// src/inbound-receipt/inbound-receipt.controller.ts
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
import { InboundReceiptService } from './inbound-receipt.service';
import { CreateInboundReceiptDto } from './dto/create-inbound-receipt.dto';
import { UpdateInboundReceiptDto } from './dto/update-inbound-receipt.dto';
import { QueryInboundReceiptDto } from './dto/query-inbound-receipt.dto';
import { ReplaceInboundReceiptItemsDto } from './dto/replace-inbound-receipt-items.dto';
import { CreateInboundReceiptFromPoDto } from './dto/create-inbound-receipt-from-po.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/inbound-receipts')
export class InboundReceiptController {
  constructor(private readonly service: InboundReceiptService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateInboundReceiptDto,
  ) {
    return this.service.create(user, dto);
  }

  @Post('from-purchase-order/:purchaseOrderId')
  createFromPurchaseOrder(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body() dto: CreateInboundReceiptFromPoDto,
  ) {
    return this.service.createFromPurchaseOrder(user, purchaseOrderId, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryInboundReceiptDto,
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
    @Body() dto: UpdateInboundReceiptDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Put(':id/items')
  replaceItems(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReplaceInboundReceiptItemsDto,
  ) {
    return this.service.replaceItems(user, id, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.confirm(user, id);
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
