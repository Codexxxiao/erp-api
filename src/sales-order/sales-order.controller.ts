// src/sales-order/sales-order.controller.ts
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
import { SalesOrderService } from './sales-order.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { QuerySalesOrderDto } from './dto/query-sales-order.dto';
import { ChangeSalesOrderStatusDto } from './dto/change-sales-order-status.dto';
import { CreateSalesOrderFromContractDto } from './dto/create-sales-order-from-contract.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/sales-orders')
export class SalesOrderController {
  constructor(private readonly service: SalesOrderService) {}

  @Post() create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateSalesOrderDto,
  ) {
    return this.service.create(user, dto);
  }
  @Post('from-contract/:contractId') createFromContract(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('contractId') contractId: string,
    @Body() dto: CreateSalesOrderFromContractDto,
  ) {
    return this.service.createFromContract(user, contractId, dto);
  }
  @Get() findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QuerySalesOrderDto,
  ) {
    return this.service.findMany(user, query);
  }
  @Get(':id') findOne(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.findOne(user, id);
  }
  @Patch(':id') update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto,
  ) {
    return this.service.update(user, id, dto);
  }
  @Post(':id/status') changeStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ChangeSalesOrderStatusDto,
  ) {
    return this.service.changeStatus(user, id, dto);
  }
  @Delete(':id') remove(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.remove(user, id);
  }
}
