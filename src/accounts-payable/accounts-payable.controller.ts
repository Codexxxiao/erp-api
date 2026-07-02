// src/accounts-payable/accounts-payable.controller.ts
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
import { AccountsPayableService } from './accounts-payable.service';
import { CreateAccountsPayableDto } from './dto/create-accounts-payable.dto';
import { UpdateAccountsPayableDto } from './dto/update-accounts-payable.dto';
import { QueryAccountsPayableDto } from './dto/query-accounts-payable.dto';
import { CreateApFromPurchaseOrderDto } from './dto/create-ap-from-purchase-order.dto';
import { CreateApFromInboundReceiptDto } from './dto/create-ap-from-inbound-receipt.dto';
import { CreateApPaymentDto } from './dto/create-ap-payment.dto';
import { UpdateApPaymentDto } from './dto/update-ap-payment.dto';
import { QueryApPaymentDto } from './dto/query-ap-payment.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/accounts-payable')
export class AccountsPayableController {
  constructor(private readonly service: AccountsPayableService) {}

  @Post('payables') createPayable(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateAccountsPayableDto,
  ) {
    return this.service.createPayable(user, dto);
  }
  @Post('payables/from-purchase-order/:purchaseOrderId')
  createFromPurchaseOrder(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body() dto: CreateApFromPurchaseOrderDto,
  ) {
    return this.service.createFromPurchaseOrder(user, purchaseOrderId, dto);
  }
  @Post('payables/from-inbound-receipt/:receiptId') createFromInboundReceipt(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('receiptId') receiptId: string,
    @Body() dto: CreateApFromInboundReceiptDto,
  ) {
    return this.service.createFromInboundReceipt(user, receiptId, dto);
  }
  @Get('payables') findPayables(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryAccountsPayableDto,
  ) {
    return this.service.findPayables(user, query);
  }
  @Get('payables/:id') findPayable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.findPayable(user, id);
  }
  @Patch('payables/:id') updatePayable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccountsPayableDto,
  ) {
    return this.service.updatePayable(user, id, dto);
  }
  @Post('payables/:id/confirm') confirmPayable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.confirmPayable(user, id);
  }
  @Post('payables/:id/cancel') cancelPayable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelPayable(user, id);
  }
  @Delete('payables/:id') removePayable(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelPayable(user, id);
  }

  @Post('payments') createPayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateApPaymentDto,
  ) {
    return this.service.createPayment(user, dto);
  }
  @Get('payments') findPayments(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryApPaymentDto,
  ) {
    return this.service.findPayments(user, query);
  }
  @Get('payments/:id') findPayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.findPayment(user, id);
  }
  @Patch('payments/:id') updatePayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateApPaymentDto,
  ) {
    return this.service.updatePayment(user, id, dto);
  }
  @Post('payments/:id/confirm') confirmPayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.confirmPayment(user, id);
  }
  @Post('payments/:id/cancel') cancelPayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelPayment(user, id);
  }
  @Delete('payments/:id') removePayment(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelPayment(user, id);
  }
}
