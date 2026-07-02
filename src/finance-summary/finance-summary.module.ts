import { Module } from '@nestjs/common';
import { CurrencyRateModule } from '../currency-rate/currency-rate.module';
import { FinanceSummaryController } from './finance-summary.controller';
import { ProfitService } from './profit.service';

@Module({
  imports: [CurrencyRateModule],
  controllers: [FinanceSummaryController],
  providers: [ProfitService],
  exports: [ProfitService],
})
export class FinanceSummaryModule {}
