import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { ProfitService } from './profit.service';
import { QueryProfitDto } from './dto/query-profit.dto';
import { QueryProfitOverviewDto } from './dto/query-profit-overview.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/finance-summary')
export class FinanceSummaryController {
  constructor(private readonly profitService: ProfitService) {}

  @Get('profit/sales-orders')
  findSalesOrderProfits(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryProfitDto,
  ) {
    return this.profitService.findSalesOrderProfits(user, query);
  }

  @Get('profit/sales-orders/:salesOrderId')
  findSalesOrderProfit(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('salesOrderId') salesOrderId: string,
    @Query('targetCurrencyCode') targetCurrencyCode?: string,
  ) {
    return this.profitService.findSalesOrderProfit(
      user,
      salesOrderId,
      targetCurrencyCode,
    );
  }

  @Get('profit/overview')
  overview(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryProfitOverviewDto,
  ) {
    return this.profitService.overview(user, query);
  }
}
