import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DynamicQueryPlanInput } from './dynamic-query.types';
import { DynamicQueryPlannerService } from './dynamic-query-planner.service';

@Injectable()
export class DynamicQueryExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: DynamicQueryPlannerService,
  ) {}

  buildPlan(input: DynamicQueryPlanInput) {
    return this.planner.buildPlan(input);
  }

  async query(input: DynamicQueryPlanInput) {
    const plan = this.planner.buildPlan(input);
    const offset = (plan.page - 1) * plan.pageSize;

    const countRows = await this.prisma.$queryRawUnsafe<
      Array<{ total: bigint }>
    >(plan.countSql, ...plan.values);

    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `${plan.listSql} LIMIT $${plan.values.length + 1} OFFSET $${plan.values.length + 2}`,
      ...plan.values,
      plan.pageSize,
      offset,
    );

    return {
      total: Number(countRows[0]?.total ?? 0),
      page: plan.page,
      pageSize: plan.pageSize,
      columns: plan.visibleColumns,
      list: rows.map((row) => this.planner.mapRow(row, plan.aliases)),
    };
  }
}
