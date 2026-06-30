import { Module } from '@nestjs/common';
import { DynamicQueryExecutorService } from './dynamic-query-executor.service';
import { DynamicQueryPlannerService } from './dynamic-query-planner.service';

@Module({
  providers: [DynamicQueryPlannerService, DynamicQueryExecutorService],
  exports: [DynamicQueryPlannerService, DynamicQueryExecutorService],
})
export class DynamicQueryModule {}
