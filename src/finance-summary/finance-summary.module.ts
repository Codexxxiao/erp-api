import { Module } from '@nestjs/common';
import { FinanceSummaryController } from './finance-summary.controller';
import { ProfitService } from './profit.service';

@Module({
  controllers: [FinanceSummaryController],
  providers: [ProfitService],
  exports: [ProfitService],
})
export class FinanceSummaryModule {}
