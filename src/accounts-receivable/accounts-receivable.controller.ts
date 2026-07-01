// src/accounts-receivable/accounts-receivable.controller.ts
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
import { AccountsReceivableService } from './accounts-receivable.service';
import { CreateAccountsReceivableDto } from './dto/create-accounts-receivable.dto';
import { UpdateAccountsReceivableDto } from './dto/update-accounts-receivable.dto';
import { QueryAccountsReceivableDto } from './dto/query-accounts-receivable.dto';
import { CreateArFromSalesOrderDto } from './dto/create-ar-from-sales-order.dto';
import { CreateArFromOutboundShipmentDto } from './dto/create-ar-from-outbound-shipment.dto';
import { CreateArPaymentDto } from './dto/create-ar-payment.dto';
import { UpdateArPaymentDto } from './dto/update-ar-payment.dto';
import { QueryArPaymentDto } from './dto/query-ar-payment.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/accounts-receivable')
export class AccountsReceivableController {
  constructor(private readonly service: AccountsReceivableService) {}

  @Post('receivables')
  createReceivable(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateAccountsReceivableDto,
  ) {
    return this.service.createReceivable(user, dto);
  }

  @Post('receivables/from-sales-order/:salesOrderId')
  createFromSalesOrder(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('salesOrderId') salesOrderId: string,
    @Body() dto: CreateArFromSalesOrderDto,
  ) {
    return this.service.createFromSalesOrder(user, salesOrderId, dto);
  }

  @Post('receivables/from-outbound-shipment/:shipmentId')
  createFromOutboundShipment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: CreateArFromOutboundShipmentDto,
  ) {
    return this.service.createFromOutboundShipment(user, shipmentId, dto);
  }

  @Get('receivables')
  findReceivables(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryAccountsReceivableDto,
  ) {
    return this.service.findReceivables(user, query);
  }

  @Get('receivables/:id')
  findReceivable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.findReceivable(user, id);
  }

  @Patch('receivables/:id')
  updateReceivable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccountsReceivableDto,
  ) {
    return this.service.updateReceivable(user, id, dto);
  }

  @Post('receivables/:id/confirm')
  confirmReceivable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.confirmReceivable(user, id);
  }

  @Post('receivables/:id/cancel')
  cancelReceivable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelReceivable(user, id);
  }

  @Delete('receivables/:id')
  removeReceivable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelReceivable(user, id);
  }

  @Post('payments')
  createPayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateArPaymentDto,
  ) {
    return this.service.createPayment(user, dto);
  }

  @Get('payments')
  findPayments(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryArPaymentDto,
  ) {
    return this.service.findPayments(user, query);
  }

  @Get('payments/:id')
  findPayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.findPayment(user, id);
  }

  @Patch('payments/:id')
  updatePayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateArPaymentDto,
  ) {
    return this.service.updatePayment(user, id, dto);
  }

  @Post('payments/:id/confirm')
  confirmPayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.confirmPayment(user, id);
  }

  @Post('payments/:id/cancel')
  cancelPayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelPayment(user, id);
  }

  @Delete('payments/:id')
  removePayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelPayment(user, id);
  }
}
